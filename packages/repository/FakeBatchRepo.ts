import { BatchRepo, IBatchRepo } from './BatchRepo';
import { Batch, IBatch, IOrderLine } from '../domain/Batch';
import { inject } from 'inversify';

export class FakeBatchRepo extends BatchRepo implements IBatchRepo {

    constructor(
        @inject('fakeBatches') private batches: IBatch[] = []
    ) {
        super();
    }

    async add(batch: IBatch): Promise<string> {
        this.batches.push(batch);
        return batch.reference;
    }

    async get(ref: string): Promise<IBatch> {
        const batch = this.batches.find(b => b.reference === ref);
        if (!batch) {
            throw new Error('Batch not found');
        }
        return batch;
    }

    async allocate(ref: string, line: IOrderLine): Promise<string> {
        const batch = await this.get(ref);
        batch.allocate(line);
        return batch.reference;
    }

    async load(limit: number): Promise<IBatch[]> {
        return this.batches.slice(0, limit).map((item) => {
            return new Batch(
                item.reference,
                item.sku,
                item.available_quantity,
                item.eta
            );
        });
    }
}