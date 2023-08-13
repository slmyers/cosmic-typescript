import { Container } from 'inversify';
import { MessageBusService } from '../../../lib/service/MessageBusService';
import { chance } from '../../jest.setup';
import { IOrderLine, makeBatchWithOrders, IProduct } from '../../../lib/domain/Product';
import { FakeProductRepo } from '../../../lib/repository/fakes/ProductRepo';
import { IProductAggregateClient } from '../../../lib/unit-of-work/ProductUoW';
import * as ProductEvents from '../../../lib/domain/ProductEvent';

describe('MessageBusService', () => {
    let container: Container;
    let repository: FakeProductRepo;
    let product: IProduct;
    let sku: string;
    let originalOrder: IOrderLine;
    let client: IProductAggregateClient;
    let service: MessageBusService;

    beforeEach(() => {
        container = chance.container();
        client = chance.client();
        sku = chance.word();
        originalOrder = chance.orderLine({ sku, qty: 1 });
        const batch = makeBatchWithOrders(
            chance.batch({ sku, max_quantity: 5 }),
            [originalOrder]
        );
        product = chance.product({ sku, batches: [batch] });

        container.bind('fakeProducts').toConstantValue([product]);
        repository = container.get('ProductRepo');
        container.bind('ProductRepo').toConstantValue(repository);        
        container.bind('AggregateClient').toConstantValue(client);

        service = container.get('MessageBusService');
    });

    describe('publish', () => {
        it('should publish', async () => {
            const event = chance.productEvent();
            await service.publish(event);
        });

        it('should allocate', async () => {
            const order = chance.orderLine({ sku, qty: 1 });
            const event = new ProductEvents.ProductAllocationRequredEventV1(
                order.orderId,
                order.sku,
                order.qty,
            );

            await service.publish(event);

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
    });
});