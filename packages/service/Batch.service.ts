import { inject, injectable } from 'inversify';
import { IBatch, IOrderLine, allocate } from '../domain/Batch';
import { BatchRepo } from '../repository/BatchRepo';

export interface IBatchService {
    get(ref: string): Promise<IBatch>;
    add(batch: IBatch): Promise<string>;
    allocate(line: IOrderLine): Promise<string>;
}

@injectable()
export class BatchService implements IBatchService {

    constructor(@inject(BatchRepo) private repo: BatchRepo) {}

    get(ref: string): Promise<IBatch > {
        return this.repo.get(ref);
    }
    add(batch: IBatch): Promise<string> {
        return this.repo.add(batch);
    }

    async allocate(line: IOrderLine): Promise<string> {
        const batches = await this.repo.load(10);

        const ref = allocate(batches, line);

        if (ref) {
            return this.repo.allocate(ref, line);
        }

        return '';
    }
}