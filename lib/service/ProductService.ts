import { inject, injectable } from 'inversify';
import { IOrderLine, IProduct } from '../domain/Product';
import { IProductUoW } from '../unit-of-work/ProductUoW';

export interface IProductService {
    allocate(sku: string, order: IOrderLine): Promise<IProduct>;
    deallocate(sku: string, orderId: string): Promise<void>;
}

@injectable()
export class ProductService implements IProductService {

    constructor(
        @inject('ProductUoW') private uow: IProductUoW,
    ) {}

    async allocate(sku: string, order: IOrderLine): Promise<IProduct> {
        return this.uow.transaction(
            sku,
            (product) => {
                product.allocate(order);
            }
        );
    }
    async deallocate(sku: string, orderId: string): Promise<void> {
        await this.uow.transaction(
            sku,
            (product) => {
                product.deallocate(orderId);
            }
        );
    }

}