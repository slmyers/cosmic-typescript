import { IProductRepo } from '../ProductRepo';
import { IProduct, IOrderLine } from '../../domain/Product';
import { inject, injectable } from 'inversify';

@injectable()
export class FakeProductRepo implements IProductRepo {

    allocateSpy: jest.SpyInstance;
    deallocateSpy: jest.SpyInstance;
    updateDescriptionSpy: jest.SpyInstance;
    updateVersionSpy: jest.SpyInstance;
    loadSpy: jest.SpyInstance;

    constructor(
        @inject('fakeProducts') private products: IProduct[] = []
    ) {
        this.initSpies();
    }
    async updateDescription(sku: string, description: string): Promise<void> {
        const product = this.products.find(p => p.sku === sku);
        if (product) {
            product.description = description;
            return;
        }
    }
    async load(sku: string): Promise<IProduct> {
        const product = this.products.find(p => p.sku === sku);
        if (product) {
            return product;
        }

        throw new Error('Product not found');
    }
    async allocate(batchReference: string, orderLine: IOrderLine): Promise<string> {
        const product = this.products.find(p => p.sku === orderLine.sku);
        if (product) {
            const batch = product.batches.find(b => b.reference === batchReference);
            if (batch) {
                batch.allocate(orderLine);
                return batch.reference;
            }
        }

        throw new Error('Batch not found');
    }
    async deallocate(batchReference: string, line: IOrderLine): Promise<void> {
        const product = this.products.find(p => p.sku === line.sku);
        if (product) {
            const batch = product.batches.find(b => b.reference === batchReference);
            if (batch) {
                batch.deallocate(line);
            }
            return;
        }

        throw new Error('Batch not found');
    }
    async updateVersion(sku: string, version: number): Promise<void> {
        const product = this.products.find(p => p.sku === sku);
        if (product) {
            product.version = version;
            return;
        }

        throw new Error('Product not found');
    }
    // async updateDescription(sku: string, description: string): Promise<void> {
    //     throw new Error('Method not implemented.');
    // }
    // async load(sku: string): Promise<IProduct> {
    //     throw new Error('Method not implemented.');
    // }

    initSpies = () => {
        this.allocateSpy = jest.spyOn<FakeProductRepo, 'allocate'>(this, 'allocate');
        this.deallocateSpy = jest.spyOn<FakeProductRepo, 'deallocate'>(this, 'deallocate');
        this.updateVersionSpy = jest.spyOn<FakeProductRepo, 'updateVersion'>(this, 'updateVersion');
        // this.updateDescriptionSpy = jest.spyOn<FakeProductRepo, 'updateDescription'>(this, 'updateDescription');
        this.loadSpy = jest.spyOn<FakeProductRepo, 'load'>(this, 'load');
    };

    get spies() {
        return {
            allocate: this.allocateSpy,
            deallocate: this.deallocateSpy,
            updateVersion: this.updateVersionSpy,
            updateDescription: this.updateDescriptionSpy,
            load: this.loadSpy,
        };
    }

    resetSpies = () => {
        this.allocateSpy.mockReset();
        this.deallocateSpy.mockReset();
        this.allocateSpy.mockReset();
        this.updateDescriptionSpy.mockReset();
    };
}