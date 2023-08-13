import { inject, injectable } from 'inversify';
import { Patch, immerable, createDraft, finishDraft, Draft } from 'immer';
import {
    Batch,
    IProduct,
    OrderLine,
    Product,
} from '../domain/Product';
import { IProductRepo, IProductClient } from '../repository/ProductRepo';
import { CosmicConfig } from '../../config/cosmic';


export interface IProductAggregateClient extends IProductClient {
    connect(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    release(): Promise<void>;
}

export interface IProductUoW {
    transaction(
        sku: string,
        fn: (product: TrackedProduct) => void,
    ): Promise<IProduct>;
    state: 'open' | 'closed' | 'begin' | 'commit' | 'rollback' | 'released';
}

export class TrackedProduct extends Product {
    [immerable] = true;
}

export class TrackedBatch extends Batch {
    [immerable] = true;

    constructor(
        public reference: string,
        public sku: string,
        public max: number,
        public eta: Date,
        orderLines: OrderLine[] = [],
    ) {
        super(reference, sku, max, eta);
        for (const order of orderLines) {
            this.allocated.set(order.orderId, order);
        }
    }
}


@injectable()
export class ProductUoW implements IProductUoW {
    public state: 'open' | 'closed' | 'begin' | 'commit' | 'rollback' | 'released' = 'closed';
    private locked: Set<string> = new Set();
    private loaded: Map<string, TrackedProduct> = new Map();
    private drafts: WeakMap<TrackedProduct, Draft<TrackedProduct>> = new WeakMap();

    constructor(
        @inject('ProductRepo') private repo: IProductRepo,
        @inject('AggregateClient') private client: IProductAggregateClient,
        @inject('CosmicConfig') private config: CosmicConfig,
    ) {}

    async release(): Promise<void> {
        if (this.state === 'closed' || this.state === 'commit' || this.state === 'rollback' || this.state === 'open') {
            await this.client.release();
            this.state = 'released';
        }
    }

    async transaction(
        sku: string,
        fn: (product: TrackedProduct) => void,
    ): Promise<IProduct> {
        await this.connect();
        await this.begin();
        let patches: Patch[] = [];
        try {
            await this.lock(sku);
            const product = await this.load(sku);
            const draft = this.resolveDraft(product);
            fn(draft);
            const result = finishDraft(
                draft,
                (p: Patch[]) => patches = p
            );
            await this.commit(patches, result);
            this.updateDraft(product, draft);
            return result;
        } catch (e) {
            await this.rollback();
            throw e;
        } finally {
            await this.release();
        }
    }

    async connect(): Promise<void> {
        if (this.state === 'closed') {
            this.state = 'open';
        }
    }

    async lock(sku: string): Promise<void> {
        if (this.state === 'begin') {
            if (this.config.concurrencyMode === 'pessimistic'
            && !this.locked.has(sku)) {
                await this.client.query('SELECT FROM product WHERE sku = $1 FOR UPDATE', [sku]);
            }
            return;
        }
        
        throw new Error(
            'Unable to lock: ' + sku + 
            ' in state: ' + this.state + 
            ' with concurrency mode: ' + this.config.concurrencyMode 
        );
    }

    async begin(): Promise<void> {
        if (this.state === 'closed') {
            await this.connect();
        }
        if (this.state === 'open') {
            if (this.config.concurrencyMode === 'optimistic') {
                await this.client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;');
            } else {
                await this.client.query('BEGIN;');
            }
            this.state = 'begin';
        }
    }

    async load(sku: string): Promise<TrackedProduct> {
        if (this.state !== 'begin') {
            throw new Error('Unable to load product in state: ' + this.state);
        }

        if (this.loaded.has(sku)) {
            return this.loaded.get(sku) as TrackedProduct;
        }

        const product = await this.repo.load(sku, this.client);

        const trackedBatches = product.batches.map(b => new TrackedBatch(
            b.reference,
            b.sku,
            b.available_quantity,
            b.eta,
            b.allocatedOrders(),
        ));

        const trackedProduct = new TrackedProduct(
            product.sku,
            product.description,
            trackedBatches,
            product.version
        );

        this.loaded.set(sku, trackedProduct);

        
        return trackedProduct;
    }

    async rollback(): Promise<void> {
        if (this.state === 'begin') {
            await this.client.query('ROLLBACK');
            this.state = 'rollback';
        }
    }

    async commit(patches: Patch[], product: TrackedProduct): Promise<void> {
        if (this.state === 'begin') {
            for (const patch of patches) {
                switch (patch.path[0]) {
                case 'batches': {
                    if (patch.path[2] === 'allocated') {
                        const batch = product.batches[patch.path[1]];
                        if (batch) {
                            if (patch.op === 'add') {
                                await this.repo.allocate(
                                    batch.reference,
                                    patch.value as OrderLine,
                                    this.client
                                );
                            } else if (patch.op === 'remove') {
                                await this.repo.deallocate(
                                    batch.reference,
                                    {
                                        orderId: patch.path[3],
                                        sku: batch.sku,
                                    } as OrderLine,
                                    this.client
                                );
                            }
                        }
                    }
                    break;
                }
                case 'version': {
                    if (patch.op === 'replace') {
                        await this.repo.updateVersion(product.sku, patch.value, this.client);
                    }
                    break;  
                }
                case 'description': {
                    if (patch.op === 'replace') {
                        await this.repo.updateDescription(product.sku, patch.value, this.client);
                    }
                    break;
                }
                }
            }
            await this.client.query('COMMIT');
            this.state = 'commit';
        }
    }

    private resolveDraft(product): Draft<TrackedProduct> {
        if (this.drafts.has(product)) {
            const d = this.drafts.get(product);
            if (d) {
                return d;
            }
        }

        const draft = createDraft(product);
        this.drafts.set(product, draft);
        return draft;
    }

    private updateDraft(product: TrackedProduct, draft: Draft<TrackedProduct>): void {
        if (this.drafts.has(product)) {
            this.drafts.set(product, draft);
        }
    }
}