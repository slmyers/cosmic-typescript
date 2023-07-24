import { Container } from 'inversify';
import { ProductRepo, IProductRepo } from '../../../lib/repository/ProductRepo';
import { Pool } from '../../../lib/infra/pg';
import { parentContainer, chance } from '../../jest.setup';
import { PoolClient } from 'pg';
import { CosmicConfig } from '../../../config/cosmic';

describe('ProductRepo', () => {
    
    let container: Container;
    let pool: Pool;
    let client: PoolClient;
    let config: CosmicConfig;
    let sku: string;
    let ref: string;
    let repro: IProductRepo;

    beforeAll(async () => {
        container = parentContainer.createChild();
        config = container.get('CosmicConfig');
        pool = new Pool(config);
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('load', () => {

        beforeEach(async () => {
            container = parentContainer.createChild();
    
            client = await pool.connect();
            sku = chance.word();
            ref = chance.guid();
    
            await client.query('BEGIN');
            await client.query(
                'INSERT INTO product (sku, description, version) VALUES ($1, $2, 1);',
                [sku, chance.word()]
            );
            await client.query(
                'INSERT INTO batch (reference, sku, max_quantity, eta) VALUES ($1, $2, $3, $4) RETURNING reference',
                [ref, sku, 10, new Date()]
            );
            await client.query(
                'INSERT INTO order_line (order_id, sku, qty, batch_reference) VALUES ($1, $2, $3, $4)',
                [chance.guid(), sku, 5, ref]
            );
    
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);

            repro = container.get<IProductRepo>('ProductRepo');
        });
        
        afterEach(async () => {
            await client.query('ROLLBACK');
            await client.release();
        });

        it('should return a product', async () => {
            const product = await repro.load(sku, client);
            // const existing = (await client.query('SELECT * FROM product')).rows;
            // console.log(existing);
            expect(product).toBeDefined();
            expect(product.sku).toEqual(sku);
            expect(product.batches.length).toEqual(1);
            expect(product.batches[0].reference).toEqual(ref);
            expect(product.batches[0].available_quantity).toEqual(5);
            expect(product.batches[0].eta).toBeDefined();
            expect(product.batches[0].allocatedOrders()).toHaveLength(1);
        });
    });

    describe('allocate', () => {
        beforeEach(async () => {
            container = parentContainer.createChild();
    
            client = await pool.connect();
            sku = chance.word();
            ref = chance.guid();
    
            await client.query('BEGIN');
            await client.query(
                'INSERT INTO product (sku, description, version) VALUES ($1, $2, 1);',
                [sku, chance.word()]
            );
            await client.query(
                'INSERT INTO batch (reference, sku, max_quantity, eta) VALUES ($1, $2, $3, $4) RETURNING reference',
                [ref, sku, 10, new Date()]
            );
            await client.query(
                'INSERT INTO order_line (order_id, sku, qty, batch_reference) VALUES ($1, $2, $3, $4)',
                [chance.guid(), sku, 5, ref]
            );
    
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);

            repro = container.get<IProductRepo>('ProductRepo');
        });

        afterEach(async () => {
            await client.query('ROLLBACK');
            await client.release();
        });

        it('should allocate a batch', async () => {
            const line = chance.orderLine({ sku, qty: 5 });
            const result = await repro.allocate(ref, line, client);
            expect(result).toEqual(line.orderId);

            const product = await repro.load(sku, client);
            expect(product).toBeDefined();
            expect(product.sku).toEqual(sku);
            expect(product.batches.length).toEqual(1);
            expect(product.batches[0].reference).toEqual(ref);
            expect(product.batches[0].available_quantity).toEqual(0);
            expect(product.batches[0].eta).toBeDefined();
            expect(product.batches[0].allocatedOrders()).toHaveLength(2);
        });
    });

    describe('deallocate', () => {
        beforeEach(async () => {
            container = parentContainer.createChild();
    
            client = await pool.connect();
            sku = chance.word();
            ref = chance.guid();
    
            await client.query('BEGIN');
            await client.query(
                'INSERT INTO product (sku, description, version) VALUES ($1, $2, 1);',
                [sku, chance.word()]
            );
            await client.query(
                'INSERT INTO batch (reference, sku, max_quantity, eta) VALUES ($1, $2, $3, $4) RETURNING reference',
                [ref, sku, 10, new Date()]
            );
            await client.query(
                'INSERT INTO order_line (order_id, sku, qty, batch_reference) VALUES ($1, $2, $3, $4)',
                [chance.guid(), sku, 5, ref]
            );
    
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);

            repro = container.get<IProductRepo>('ProductRepo');
        });

        afterEach(async () => {
            await client.query('ROLLBACK');
            await client.release();
        });

        it('should deallocate a batch', async () => {
            const line = chance.orderLine({ sku, qty: 5 });
            await repro.allocate(ref, line, client);
            await repro.deallocate(ref, line, client);

            const product = await repro.load(sku, client);
            expect(product).toBeDefined();
            expect(product.sku).toEqual(sku);
            expect(product.batches.length).toEqual(1);
            expect(product.batches[0].reference).toEqual(ref);
            expect(product.batches[0].available_quantity).toEqual(5);
            expect(product.batches[0].eta).toBeDefined();
            expect(product.batches[0].allocatedOrders()).toHaveLength(1);
        });
    });

    describe('updateVersion', () => {
        beforeEach(async () => {
            container = parentContainer.createChild();
    
            client = await pool.connect();
            sku = chance.word();
            ref = chance.guid();
    
            await client.query('BEGIN');
            await client.query(
                'INSERT INTO product (sku, description, version) VALUES ($1, $2, 1);',
                [sku, chance.word()]
            );
            await client.query(
                'INSERT INTO batch (reference, sku, max_quantity, eta) VALUES ($1, $2, $3, $4) RETURNING reference',
                [ref, sku, 10, new Date()]
            );
            await client.query(
                'INSERT INTO order_line (order_id, sku, qty, batch_reference) VALUES ($1, $2, $3, $4)',
                [chance.guid(), sku, 5, ref]
            );
    
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);

            repro = container.get<IProductRepo>('ProductRepo');
        });

        afterEach(async () => {
            await client.query('ROLLBACK');
            await client.release();
        });

        it('should update the version', async () => {
            await repro.updateVersion(sku, 2, client);

            const product = await repro.load(sku, client);
            expect(product).toBeDefined();
            expect(product.sku).toEqual(sku);
            expect(product.batches.length).toEqual(1);
            expect(product.batches[0].reference).toEqual(ref);
            expect(product.batches[0].available_quantity).toEqual(5);
            expect(product.batches[0].eta).toBeDefined();
            expect(product.batches[0].allocatedOrders()).toHaveLength(1);
            expect(product.version).toEqual(2);
        });
    });

    describe('updateDescription', () => {
        beforeEach(async () => {
            container = parentContainer.createChild();
    
            client = await pool.connect();
            sku = chance.word();
            ref = chance.guid();
    
            await client.query('BEGIN');
            await client.query(
                'INSERT INTO product (sku, description, version) VALUES ($1, $2, 1);',
                [sku, chance.word()]
            );
            await client.query(
                'INSERT INTO batch (reference, sku, max_quantity, eta) VALUES ($1, $2, $3, $4) RETURNING reference',
                [ref, sku, 10, new Date()]
            );
            await client.query(
                'INSERT INTO order_line (order_id, sku, qty, batch_reference) VALUES ($1, $2, $3, $4)',
                [chance.guid(), sku, 5, ref]
            );
    
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);

            repro = container.get<IProductRepo>('ProductRepo');
        });

        afterEach(async () => {
            await client.query('ROLLBACK');
            await client.release();
        });

        it('should update the description', async () => {
            const desc = chance.word();
            await repro.updateDescription(sku, desc, client);

            const product = await repro.load(sku, client);
            expect(product).toBeDefined();
            expect(product.sku).toEqual(sku);
            expect(product.batches.length).toEqual(1);
            expect(product.batches[0].reference).toEqual(ref);
            expect(product.batches[0].available_quantity).toEqual(5);
            expect(product.batches[0].eta).toBeDefined();
            expect(product.batches[0].allocatedOrders()).toHaveLength(1);
            expect(product.version).toEqual(1);
            expect(product.description).toEqual(desc);
        });
    });
});