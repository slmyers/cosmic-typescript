import { inject, injectable } from 'inversify';
import { IProductEvent, ProductAllocationRequredEventV1, ProductDeallocationRequredEventV1 } from '../domain/ProductEvent';
import { IProductUoW } from '../unit-of-work/ProductUoW';
import { OrderLine, IProduct } from '../domain/Product';

export interface IMessageBus {
    publish(event: IProductEvent): Promise<void>;
}

@injectable()
export class MessageBusService implements IMessageBus {
    constructor(
        @inject('ProductUoW') private uow: IProductUoW,
    ) {}

    async publish(event: IProductEvent): Promise<void> {
        switch(event.type) {
        case 'ProductOutOfStock':
            await this.handleOutOfStockEvent(event);
            break;
        case 'ProductAllocationRequred':
            await this.handleAllocate(event);
            break;
        case 'ProductDeallocationRequred':
            await this.handleDeallocate(event);
            break;
        default:
            console.error(`Unknown event type ${event.type}`);
        }
    }

    async handleOutOfStockEvent(event: IProductEvent): Promise<void> {
        console.log(`Handling out of stock event for ${event.sku}`);
    }

    async handleAllocate(event: IProductEvent): Promise<IProduct> {
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
    async handleDeallocate(event: IProductEvent): Promise<void> {
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
