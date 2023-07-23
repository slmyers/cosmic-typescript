import { inject, injectable } from 'inversify';
import { IOrderLine, IProduct } from '../domain/Product';
import { IProductUoW } from '../unit-of-work/ProductUoW';

export interface IProductService {
    allocate(order: IOrderLine): Promise<IProduct>;
    deallocate(order: IOrderLine): Promise<void>;
}

@injectable()
export class ProductService implements IProductService {

    constructor(
        @inject('ProductUoW') private uow: IProductUoW,
    ) {}

    async allocate(order: IOrderLine): Promise<IProduct> {
        return this.uow.transaction(
            order.sku,
            (product) => {
                product.allocate(order);
            }
        );
    }
    async deallocate(order: IOrderLine): Promise<void> {
        await this.uow.transaction(
            order.sku,
            (product) => {
                product.deallocate(order);
            }
        );
    }

}