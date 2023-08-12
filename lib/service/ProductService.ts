import { inject, injectable } from 'inversify';
import { IProduct, OrderLine } from '../domain/Product';
import {
    IProductEvent,
    ProductAllocationRequredEventV1,
    ProductDeallocationRequredEventV1,
} from '../domain/ProductEvent';
import { IProductUoW } from '../unit-of-work/ProductUoW';

export interface IProductService {
    allocate(event: IProductEvent): Promise<IProduct>;
    deallocate(event: IProductEvent): Promise<void>;
}

@injectable()
export class ProductService implements IProductService {

    constructor(
        @inject('ProductUoW') private uow: IProductUoW,
    ) {}

    async allocate(event: IProductEvent): Promise<IProduct> {
        if (event.type !== 'ProductAllocationRequred') {
            throw new Error('Invalid event type: ' + event.type);
        }
        if (event.eventVersion === 1) {
            const e = event as ProductAllocationRequredEventV1;
            return this.uow.transaction(
                e.sku,
                (product) => {
                    product.allocate( new OrderLine(e.orderId, e.sku, e.qty) );
                }
            );
        } else {
            throw new Error('Invalid event version: ' + event.eventVersion);
        }
    }
    async deallocate(event: IProductEvent): Promise<void> {
        if (event.type !== 'ProductDeallocationRequred') {
            throw new Error('Invalid event type: ' + event.type);
        }
        if (event.eventVersion === 1) {
            const e = event as ProductDeallocationRequredEventV1;
            await this.uow.transaction(
                e.sku,
                (product) => {
                    product.deallocate(e.orderId);
                }
            );
        } else {
            throw new Error('Invalid event version: ' + event.eventVersion);
        }
    }

}