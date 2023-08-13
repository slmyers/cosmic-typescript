import { inject, injectable } from 'inversify';
import { IProductEvent } from '../domain/ProductEvent';
import { IProductUoW } from '../unit-of-work/ProductUoW';
import { IMessageHandlers } from './MessageHandlers';

export interface IMessageBus {
    publish(event: IProductEvent): Promise<void>;
}

@injectable()
export class MessageBusService implements IMessageBus {
    constructor(
        @inject('ProductUoW') private uow: IProductUoW,
        @inject('MessageHandlers') private handlers: IMessageHandlers,
    ) {}

    async publish(event: IProductEvent): Promise<void> {
        switch(event.type) {
        case 'ProductOutOfStock':
            await this.handlers[event.type](event);
            break;
        case 'ProductAllocationRequred':
        case 'ProductDeallocationRequred':
            await this.handlers[event.type](event, this.uow);
            break;
        default:
            console.error(`Unknown event type ${event.type}`);
        }
    }
}
