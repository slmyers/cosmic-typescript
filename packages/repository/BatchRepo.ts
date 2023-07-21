import { injectable } from 'inversify';
import { IBatch, IOrderLine } from '../domain/Batch';


export interface IBatchRepo {
    add(batch: IBatch): Promise<string>;
    get(reference: string): Promise<IBatch>;
    load(limit: number): Promise<IBatch[]>;
    allocate(ref: string, line: IOrderLine): Promise<string>;
}

@injectable()
export class BatchRepo implements IBatchRepo {
    async add(batch: IBatch): Promise<string> {

        throw new Error('Not implemented: ' + JSON.stringify(batch));
    }

    async get(ref: string): Promise<IBatch> {
        throw new Error('Not implemented: ' + JSON.stringify(ref));
    }

    async allocate(ref: string, line: IOrderLine): Promise<string> {
        throw new Error('Not implemented: ' + JSON.stringify({ ref, line }));
    }

    async load(limit: number): Promise<IBatch[]> {
        throw new Error('Not implemented: ' + JSON.stringify(limit));
    }
}