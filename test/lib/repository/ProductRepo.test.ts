import { Container } from 'inversify';
import { ProductRepo, IProductRepo } from '../../../lib/repository/ProductRepo';
import { Pool } from '../../../lib/infra/pg';
import { container as parentContainer, chance } from '../../jest.setup';
import { PoolClient } from 'pg';
import { CosmicConfig } from '../../../config/cosmic';

describe('ProductRepo', () => {
    
    let container: Container;
    let pool: Pool;
    let client: PoolClient;
    let config: CosmicConfig;
    let sku: string;
    let ref: string;

    beforeAll(() => {
        container = parentContainer.createChild();
        config = container.get('CosmicConfig');
        pool = new Pool(config);
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('get', () => {
        let repo;

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
    
            pool.transaction = jest.fn().mockImplementation(async (fn: (client: PoolClient) => Promise<any>) => {
                const result = await fn(client);
                return result;
            });
            container.bind<Pool>(Pool).toConstantValue(pool);
    
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);

            repo = container.get<IProductRepo>('ProductRepo');
        });
        
        afterEach(async () => {
            await client.query('ROLLBACK');
            await client.release();
        });

        it('should return a product', async () => {
            const product = await repo.get(sku);
            expect(product).toBeDefined();
            expect(product.sku).toEqual(sku);
            expect(product.batches.length).toEqual(1);
            expect(product.batches[0].reference).toEqual(ref);
            expect(product.batches[0].available_quantity).toEqual(5);
            expect(product.batches[0].eta).toBeDefined();
        });
    });

    describe('addBatch', () => {
        let repo;

        beforeEach(async () => {
            container = parentContainer.createChild();
    
            client = await pool.connect();
    
            sku = chance.word();
    
            await client.query('BEGIN');
            await client.query(
                'INSERT INTO product (sku, description, version) VALUES ($1, $2, 1);',
                [sku, chance.word()]
            );
    
            pool.transaction = jest.fn().mockImplementation(async (fn: (client: PoolClient) => Promise<any>) => {
                const result = await fn(client);
                return result;
            });
            container.bind<Pool>(Pool).toConstantValue(pool);
    
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);

            repo = container.get<IProductRepo>('ProductRepo');
        });
        
        afterEach(async () => {
            await client.query('ROLLBACK');
            await client.release();
        });

        it('should add a batch', async () => {
            const batch = chance.batch({ sku });
            const result = await repo.addBatch(batch);
            expect(result).toEqual(batch.reference);

            const product = await repo.get(sku);
            expect(product).toBeDefined();
            expect(product.sku).toEqual(sku);
            expect(product.batches.length).toEqual(1);
            expect(product.batches[0].reference).toEqual(batch.reference);
            expect(product.batches[0].available_quantity).toEqual(batch.available_quantity);
            expect(product.batches[0].eta.toISOString()).toEqual(batch.eta.toISOString());
        });

        it('should fail if there is no product', async () => {
            const batch = chance.batch({ sku: chance.word() });
            await expect(repo.addBatch(batch)).rejects.toThrowError('Product not found: ' + batch.sku);
        });
    });
    
    describe('add', () => {
        let repo;

        beforeEach(async () => {
            container = parentContainer.createChild();
    
            client = await pool.connect();
    
            sku = chance.word();
    
            await client.query('BEGIN');
    
            pool.transaction = jest.fn().mockImplementation(async (fn: (client: PoolClient) => Promise<any>) => {
                const result = await fn(client);
                return result;
            });
            container.bind<Pool>(Pool).toConstantValue(pool);
    
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);

            repo = container.get<IProductRepo>('ProductRepo');
        });
        
        afterEach(async () => {
            await client.query('ROLLBACK');
            await client.release();
        });

        it('should add a product', async () => {
            const product = chance.product({ sku });
            const result = await repo.add(product);
            expect(result).toEqual(product.sku);

            const dbProduct = await repo.get(sku);
            expect(dbProduct).toBeDefined();
            expect(dbProduct.sku).toEqual(sku);
            expect(dbProduct.description).toEqual(product.description);
            expect(dbProduct.version).toEqual(product.version);
        });
    });

    describe('allocate', () => {
        let repo;
        let batch;

        beforeEach(async () => {
            container = parentContainer.createChild();
    
            client = await pool.connect();
    
            sku = chance.word();
            ref = chance.guid();
            batch = chance.batch({ sku, reference: ref, available_quantity: 10 });
    
            await client.query('BEGIN');
            await client.query(
                'INSERT INTO product (sku, description, version) VALUES ($1, $2, 1);',
                [sku, chance.word()]
            );
            await client.query(
                'INSERT INTO batch (reference, sku, max_quantity, eta) VALUES ($1, $2, $3, $4) RETURNING reference',
                [batch.reference, batch.sku, batch.available_quantity, batch.eta]
            );
    
            pool.transaction = jest.fn().mockImplementation(async (fn: (client: PoolClient) => Promise<any>) => {
                const result = await fn(client);
                return result;
            });
            container.bind<Pool>(Pool).toConstantValue(pool);
    
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);

            repo = container.get<IProductRepo>('ProductRepo');
        });
        
        afterEach(async () => {
            await client.query('ROLLBACK');
            await client.release();
        });

        it('should allocate a batch', async () => {
            const line = chance.orderLine({ sku, qty: 5 });
            const result = await repo.allocate(batch, line);
            expect(result).toEqual(ref);

            const product = await repo.get(sku);
            expect(product).toBeDefined();
            expect(product.sku).toEqual(sku);
            expect(product.batches.length).toEqual(1);
            expect(product.batches[0].reference).toEqual(ref);
            expect(product.batches[0].available_quantity).toEqual(5);
            expect(product.version).toEqual(2);
        });

        it('should fail if there is no product', async () => {
            const line = chance.orderLine({ sku: chance.word() });
            await expect(repo.allocate(batch, line)).rejects.toThrowError('sku not found: ' + line.sku);
        });

        it('should fail if there is no batch', async () => {
            await client.query('DELETE FROM batch');

            const line = chance.orderLine({ sku });
            await expect(repo.allocate(batch, line)).rejects.toThrowError('sku not found: ' + line.sku);
        });

        it('should fail if there is not enough stock', async () => {
            const line = chance.orderLine({ sku, qty: 11 });
            await expect(repo.allocate(batch, line)).rejects.toThrowError('Out of stock: ' + line.sku);
        });
    });
});