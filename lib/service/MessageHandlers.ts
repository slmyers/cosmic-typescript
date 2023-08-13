import { injectable } from 'inversify';
import { IProductEvent, ProductAllocationRequredEventV1, ProductDeallocationRequredEventV1 } from '../domain/ProductEvent';
import { IProduct } from '../domain/Product';
import { OrderLine } from '../domain/Product';
import { IProductUoW } from '../unit-of-work/ProductUoW';

export interface IMessageHandlers {
    ProductAllocationRequred(event: IProductEvent, uow: IProductUoW): Promise<IProduct>;
    ProductDeallocationRequred(event: IProductEvent,  uow: IProductUoW): Promise<void>;
    ProductOutOfStock(event: IProductEvent): Promise<void>;
}

@injectable()
export class MessageHandlers implements IMessageHandlers {
    // These handlers should be abstracted.
    async ProductOutOfStock(event: IProductEvent): Promise<void> {
        console.log(`Handling out of stock event for ${event.sku}`);
    }
    
    async ProductAllocationRequred(event: IProductEvent, uow: IProductUoW): Promise<IProduct> {
        if (event.type !== 'ProductAllocationRequred') {
            throw new Error('Invalid event type: ' + event.type);
        }
        if (event.eventVersion === 1) {
            const e = event as ProductAllocationRequredEventV1;
            return uow.transaction(
                e.sku,
                (product) => {
                    product.allocate( new OrderLine(e.orderId, e.sku, e.qty) );
                }
            );
        } else {
            throw new Error('Invalid event version: ' + event.eventVersion);
        }
    }
    async ProductDeallocationRequred(event: IProductEvent,  uow: IProductUoW): Promise<void> {
        if (event.type !== 'ProductDeallocationRequred') {
            throw new Error('Invalid event type: ' + event.type);
        }
        if (event.eventVersion === 1) {
            const e = event as ProductDeallocationRequredEventV1;
            await uow.transaction(
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