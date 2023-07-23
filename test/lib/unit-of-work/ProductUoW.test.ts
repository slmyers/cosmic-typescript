import { produceWithPatches  } from 'immer';
import {
    IProductUoW,
    TrackedBatch,
    TrackedProduct,
} from '../../../lib/unit-of-work/ProductUoW';
import { chance, parentContainer } from '../../jest.setup';

describe('ProductUoW', () => {
    describe('TrackedProduct', () => {
        let sku;
        let batch;
        let product;
        let orderLine;
        let reference;

        beforeEach(() => {
            sku = chance.word();
            reference = chance.word();
            orderLine = chance.orderLine({ sku, batchReference: reference, qty: 5 });
            batch = chance.batch({ sku, reference, available_quantity: 10 });
            batch.allocate(orderLine);
            product = chance.product({ sku, batches: [batch] });
        });
        it('should be able to allocate', () => {
            const trackedProduct = new TrackedProduct(
                product.sku,
                product.description,
                product.batches.map(b => new TrackedBatch(b.reference, b.sku, b.available_quantity, b.eta)),
                product.version
            );

            const order = chance.orderLine({ sku, qty: 1 });
            const order2 = chance.orderLine({ sku, qty: 1 });

            const [
                newProduct,
                patches,
                // inversePatches,
            ] = produceWithPatches(trackedProduct, draft => {
                draft.allocate(order);
                draft.allocate(order2);
            });

            expect(newProduct.batches).toHaveLength(1);
            expect(newProduct.batches[0].available_quantity).toBe(3);
            expect(patches).toHaveLength(3);
            const [
                batchPatch,
                baseUpdate,
                productPatch,
            ] = patches;

            expect(batchPatch.op).toBe('add');
            expect(batchPatch.path.join('.')).toBe(`batches.0.allocated.${order.orderId}`);
            expect(batchPatch.value).toBe(order);

            expect(baseUpdate.op).toBe('add');
            expect(baseUpdate.path.join('.')).toBe(`batches.0.allocated.${order2.orderId}`);
            expect(baseUpdate.value).toBe(order2);

            expect(productPatch.op).toBe('replace');
            expect(productPatch.path.join('.')).toBe('version');
            expect(productPatch.value).toBe(3);

        });
    });

    describe('transaction', () => {
        let product;
        let batch;
        let order;
        let order2;
        let order3;
        let sku;
        let container;
        let client;
        let repro;

        beforeEach(() => {
            sku = chance.word();
            batch = chance.batch({ sku, max_quantity: 5 });
            order3 = chance.orderLine({ sku, qty: 3 });
            batch.allocate(order3);
            product = chance.product({ sku, batches: [batch] });
            container = parentContainer.createChild();
            container.bind('fakeProducts').toConstantValue([product]);

            client = chance.client();
            container.bind('AggregateClient').toConstantValue(client);

            repro = container.get('ProductRepo');
            container.bind('ProductRepo').toConstantValue(repro);
        });


        it('should allocate', async () => {
            const uow: IProductUoW = container.get('ProductUoW');
            order  = chance.orderLine({ sku, qty: 1 });
            order2 = chance.orderLine({ sku, qty: 2 });
            const res = await uow.transaction(
                sku,
                (p: TrackedProduct): void => {
                    p.allocate(order);
                    p.allocate(order2);
                },
            );

            expect(res).toBeInstanceOf(TrackedProduct);
            const allocatedOrders = res.batches[0].allocatedOrders();
            expect(allocatedOrders).toHaveLength(3);
            expect(allocatedOrders[0]).toBe(order3);
            expect(allocatedOrders[1]).toBe(order);
            expect(allocatedOrders[2]).toBe(order2);
            expect(res.version).toBe(3);

            const spies = repro.spies;
            expect(spies.allocate).toHaveBeenCalledTimes(2);
            expect(spies.allocate).toHaveBeenCalledWith(
                batch.reference,
                {
                    orderId: order.orderId,
                    sku: order.sku,
                    qty: order.qty,
                },
                client,
            );

            expect(spies.deallocate).toHaveBeenCalledTimes(0);
            expect(spies.updateVersion).toHaveBeenCalledTimes(1);
            expect(spies.updateVersion).toHaveBeenCalledWith(sku, 3, client);

            expect(client.query).toHaveBeenCalledWith('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;');
            expect(client.query).toHaveBeenCalledWith('COMMIT');
        });

        it('should deallocate', async () => {
            const uow: IProductUoW = container.get('ProductUoW');
            order  = chance.orderLine({ sku, qty: 1 });
            order2 = chance.orderLine({ sku, qty: 2 });
            const res = await uow.transaction(
                sku,
                (p: TrackedProduct): void => {
                    p.allocate(order);
                    p.allocate(order2);
                    p.deallocate(order3);
                },
            );

            expect(res).toBeInstanceOf(TrackedProduct);
            const allocatedOrders = res.batches[0].allocatedOrders();
            expect(allocatedOrders).toHaveLength(2);
            expect(allocatedOrders.some((o) => o.orderId === order.orderId)).toBe(true);
            expect(allocatedOrders.some((o) => o.orderId === order2.orderId)).toBe(true);
            expect(res.version).toBe(4);

            const spies = repro.spies;
            expect(spies.allocate).toHaveBeenCalledTimes(2);
            expect(spies.allocate).toHaveBeenCalledWith(
                batch.reference,
                {
                    orderId: order.orderId,
                    sku: order.sku,
                    qty: order.qty,
                },
                client,
            );

            expect(spies.deallocate).toHaveBeenCalledTimes(1);
            expect(spies.deallocate).toHaveBeenCalledWith(
                batch.reference,
                {
                    orderId: order3.orderId,
                    sku: order3.sku,
                },
                client,
            );
            expect(spies.updateVersion).toHaveBeenCalledTimes(1);
            expect(spies.updateVersion).toHaveBeenCalledWith(sku, 4, client);

            expect(client.query).toHaveBeenCalledWith('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;');
            expect(client.query).toHaveBeenCalledWith('COMMIT');
        });
    });
});