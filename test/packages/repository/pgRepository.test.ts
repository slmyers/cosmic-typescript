import { Container } from 'inversify';
import { PgBatchRepo } from '../../../packages/repository/PgBatchRepo';
import { BatchRepo, IBatchRepo } from '../../../packages/repository/BatchRepo';
import { Pool } from '.../../../packages/infra/pg';
import { container as parentContainer, chance } from '../../jest.setup';
import { PoolClient } from 'pg';
import { CosmicConfig } from '../../../config/cosmic';

describe('Repository', () => {
    let container: Container;
    let config: CosmicConfig;

    beforeEach(() => {
        container = new Container();
        container.parent = parentContainer;
        config = container.get('CosmicConfig');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('add', () => {
        let pool: Pool;
        let client: PoolClient;
        let testSku: string;

        beforeEach(() => {
            pool = new Pool(config);
            testSku = chance.word();
            pool.transaction = jest.fn().mockImplementation(async (fn: (client: PoolClient) => Promise<any>) => {
                client = await pool.connect();
                await client.query('BEGIN');
                await client.query('INSERT INTO product (sku, description) VALUES ($1, $2);', [testSku, chance.word()]);
                const result = await fn(client);
                return result;
            });
            container.bind<Pool>(Pool).toConstantValue(pool);
            container.bind<BatchRepo>(BatchRepo).to(PgBatchRepo);
        });

        afterEach(async () => {
            jest.clearAllMocks();
            await client.query('ROLLBACK');
            await client.release();
        });

        afterAll(async () => {
            await pool.end();
        });

        it('should save a batch', async () => {
            const repository: IBatchRepo = container.get<BatchRepo>(BatchRepo);
            const batch = chance.batch({ sku: testSku });
            const ref = await repository.add(batch);
            expect(ref).toBeDefined();

            const result = await client.query(
                'SELECT reference, sku, max_quantity, eta FROM batch WHERE reference = $1',
                [ref]
            );

            const { sku, max_quantity, eta } = result.rows[0];

            expect({
                sku,
                max_quantity,
                eta,
            }).toEqual({
                sku: batch.sku,
                max_quantity: batch.available_quantity,
                eta: batch.eta,
            });

            expect(pool.transaction).toHaveBeenCalledTimes(1);
        });

    });

    describe('get', () => {
        let pool: Pool;
        let client: PoolClient;
        let ref: string;

        beforeEach(() => {
            ref = chance.guid();
            pool = new Pool(config);
            pool.query = jest.fn().mockImplementation(async (text: string, params: string[]) => {
                client = await pool.connect();
                await client.query('BEGIN');
                await client.query(
                    'INSERT INTO product (sku, description) VALUES ($1, $2);',
                    ['SMALL-TABLE', chance.word()]
                );
                await client.query(
                    'INSERT INTO batch (reference, sku, max_quantity, eta) VALUES ($1, $2, $3, $4) RETURNING reference',
                    [ref, 'SMALL-TABLE', 10, new Date()]
                );
                const result = client.query(text, params);
                return result;
            });
            container.bind<Pool>(Pool).toConstantValue(pool);
            container.bind<BatchRepo>(BatchRepo).to(PgBatchRepo);
        });

        afterEach(async () => {
            jest.clearAllMocks();
            await client.query('ROLLBACK');
            await client.release();
        });

        afterAll(async () => {
            await pool.end();
        });

        // this test depends on pool.query using the same connection as the transaction, ie it could become flakey.
        it('should get a batch', async () => {
            const repository: IBatchRepo = container.get<BatchRepo>(BatchRepo);
            const result = await repository.get(ref);
            expect(result).toBeDefined();
            expect(result.reference).toEqual(ref);
            expect(result.sku).toEqual('SMALL-TABLE');
            expect(result.available_quantity).toEqual(10);
            expect(result.eta).toBeDefined();
            expect(pool.query).toHaveBeenCalledTimes(1);
        });
    });
});