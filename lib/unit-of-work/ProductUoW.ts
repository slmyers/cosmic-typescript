// unit of work for pg driver

import { Pool, PoolClient } from 'pg';
import { inject, injectable } from 'inversify';
import { IBatch, IOrderLine, IProduct, Product } from '../domain/Product';
import { IProductRepo } from '../repository/ProductRepo';
import { CosmicConfig } from '../../config/cosmic';

export interface IProductUoW {
    commit(): Promise<void>;
    rollback(): Promise<void>;
    release(): Promise<void>;
    add(product: IProduct): Promise<string>;
    get(sku: string): Promise<IProduct>;
    allocate(line: IOrderLine): Promise<string>;
    addBatch(batch: IBatch): Promise<string>;
    addProduct(sku: string, description: string): Promise<string>;
}

@injectable()
export class ProductUoW implements IProductUoW {
    private _client: PoolClient;
    private productRepo: IProductRepo;
    private productMap: Map<string, IProduct> = new Map();
    private connected: Promise<boolean>;


    constructor(
        @inject('ProductRepoFactory') private repoFactory: (client: PoolClient) => IProductRepo,
        @inject(Pool) private pool: Pool,
        @inject('CosmicConfig') private config: CosmicConfig,
    ) {
        this.connected = this.pool.connect().then(async (client) => {
            this.productRepo = this.repoFactory(client);
            this._client = client;
            await client.query('BEGIN');
            return true;
        });
    }

    async commit(): Promise<void> {
        if (await this.connected) {
            await this._client.query('COMMIT');
            await this._client.release();
        }        
    }

    async rollback(): Promise<void> {
        if (!(await this.connected)) {
            return;
        }

        await this._client.query('ROLLBACK');
        await this._client.release();
        this.connected = Promise.resolve(false);
    }

    async release(): Promise<void> {
        if (!(await this.connected)) {
            return;
        }

        await this._client.release();
        this.connected = Promise.resolve(false);
    }

    async add(product: IProduct): Promise<string> {
        try {
            if (!(await this.connected)) {
                throw new Error('Not connected');
            }
            const sku = await this.productRepo.add(product);
            this.productMap.set(sku, product);
            return sku;
        } catch (e) {
            await this.rollback();
            throw e;
        }
    }

    async get(sku: string): Promise<IProduct> {
        try {
            if (!(await this.connected)) {
                throw new Error('Not connected');
            }
            
            if (this.productMap.has(sku)) {
                return this.productMap.get(sku) as IProduct;
            }
            const product = await this.productRepo.get(sku);

            if (this.config.concurrencyMode === 'pessimistic') {
                await this._client.query('SELECT * FROM product WHERE sku = $1 FOR UPDATE', [sku]);
            }

            this.productMap.set(sku, product);

            return product;
        } catch (e) {
            await this.rollback();
            throw e;
        }
    }

    async allocate(line: IOrderLine): Promise<string> {
        try {
            const product = await this.get(line.sku);
            const targetRef = product.allocate(line);
            const batch = product.batches.find(b => b.reference === targetRef);
            if (!batch) {
                throw new Error('Batch not found: ' + targetRef);
            }
            const allocatedRef = await this.productRepo.allocate(batch, line);
            const res = await this._client.query(
                'UPDATE product SET version = $1 WHERE sku = $2 AND version = $3', 
                [product.version + 1, product.sku, product.version]
            );
            console.log(res);
            product.version = product.version + 1;
            return allocatedRef;
        } catch (e) {
            await this.rollback();
            throw e;
        }
    }

    async addBatch(batch: IBatch): Promise<string> {
        try {
            return await this.productRepo.addBatch(batch);
        } catch (e) {
            await this.rollback();
            throw e;
        }
    }

    async addProduct(sku: string, description: string): Promise<string> {
        try {
            const product = new Product(sku, description, [], 1);
            return await this.productRepo.add(product);
        } catch (e) {
            await this.rollback();
            throw e;
        }
    }
}
