import { IProductRepo } from '../ProductRepo';
import { IProduct, IOrderLine, IBatch } from '../../domain/Product';
import { inject } from 'inversify';

export class FakeProductRepo implements IProductRepo {

    addSpy: jest.SpyInstance;
    getSpy: jest.SpyInstance;
    allocateSpy: jest.SpyInstance;
    addBatchSpy: jest.SpyInstance;

    constructor(
        @inject('fakeProducts') private products: IProduct[] = []
    ) {}

    addBatch(batch: IBatch): Promise<string> {
        const product = this.products.find(p => p.sku === batch.sku);
        if (!product) {
            throw new Error('Product not found: ' + batch.sku);
        }
        product.batches.push(batch);
        return Promise.resolve(batch.reference);
    }

    initSpies = () => {
        this.addSpy = jest.spyOn<FakeProductRepo, 'add'>(this, 'add');
        this.getSpy = jest.spyOn<FakeProductRepo, 'get'>(this, 'get');
        this.allocateSpy = jest.spyOn<FakeProductRepo, 'allocate'>(this, 'allocate');
        this.addBatchSpy = jest.spyOn<FakeProductRepo, 'addBatch'>(this, 'addBatch');
    };

    get spies() {
        return {
            add: this.addSpy,
            get: this.getSpy,
            allocate: this.allocateSpy,
            addBatch: this.addBatchSpy,
        };
    }

    resetSpies = () => {
        this.addSpy.mockReset();
        this.getSpy.mockReset();
        this.allocateSpy.mockReset();
        this.addBatchSpy.mockReset();
    };

    async add(product: IProduct): Promise<string> {
        this.products.push(product);
        return product.sku;
    }
    
    async get(sku: string): Promise<IProduct> {
        const result = this.products.find(p => p.sku === sku);
        if (!result) {
            throw new Error('Product not found: ' + sku);
        }
        return result;
    }

    async allocate(batch: IBatch, line: IOrderLine): Promise<string> {
        if (batch.canAllocate(line)) {
            batch.allocate(line);
            return batch.reference;
        }

        throw new Error('Cannot allocate');
    }
}