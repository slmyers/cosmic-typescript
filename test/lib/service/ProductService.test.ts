import { Container } from 'inversify';
import { ProductService } from '../../../lib/service/ProductService';
import { parentContainer, chance } from '../../jest.setup';
import { IOrderLine, IProduct } from '../../../lib/domain/Product';
import { FakeProductRepo } from '../../../lib/repository/fakes/ProductRepo';
import { IProductAggregateClient } from '../../../lib/unit-of-work/ProductUoW';

describe('ProductService', () => {
    let container: Container;
    let repository: FakeProductRepo;
    let product: IProduct;
    let sku: string;
    let originalOrder: IOrderLine;
    let client: IProductAggregateClient;
    let service: ProductService;

    beforeEach(() => {
        // TODO: chance.container() ?
        container = parentContainer.createChild();

        // TODO: better container setup
        sku = chance.word();
        const batch = chance.batch({ sku, max_quantity: 5 });
        originalOrder = chance.orderLine({ sku, qty: 1 });
        batch.allocate(originalOrder);
        product = chance.product({ sku, batches: [batch] });
        container.bind('fakeProducts').toConstantValue([product]);

        repository = container.get('ProductRepo');
        container.bind('ProductRepo').toConstantValue(repository);
        // TODO: this client every time....
        client = chance.client();
        container.bind('AggregateClient').toConstantValue(client);

        service = container.get('ProductService');
    });

    describe('allocate', () => {
        it('should allocate', async () => {
            const order = chance.orderLine({ sku, qty: 1 });
            
            const res = await service.allocate(product.sku, order);

            expect(res).toBeInstanceOf(Object);
            expect(res).toHaveProperty('sku');
            expect(res).toHaveProperty('description');
            expect(res).toHaveProperty('batches');
            expect(res).toHaveProperty('version');
            expect(res.batches).toHaveLength(1);
            expect(res.batches[0].allocatedOrders()).toHaveLength(2);
            expect(res.batches[0].allocatedOrders()[0]).toBe(originalOrder);
            expect(res.batches[0].allocatedOrders()[1]).toBe(order);
            expect(res.version).toBe(2);

            const spies = repository.spies;
            expect(spies.allocate).toHaveBeenCalledTimes(1);
            expect(spies.allocate).toHaveBeenCalledWith(
                product.batches[0].reference,
                {
                    orderId: order.orderId,
                    sku: order.sku,
                    qty: order.qty,
                },
                client,
            );
        });

        it('should throw error if product is not found', async () => {
            const expectedSku = chance.word();
            await expect(service.allocate(
                product.sku,
                chance.orderLine({ sku: expectedSku })
            )).rejects.toThrow(`Out of stock for sku ${expectedSku}`);
        });
    });

});