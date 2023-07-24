import { Container } from 'inversify';
import { PoolClient, Pool } from 'pg';
import { CosmicConfig } from '../../../config/cosmic';
import { IProductRepo, ProductRepo } from '../../../lib/repository/ProductRepo';
import { parentContainer, chance } from '../../jest.setup';
import { ProductUoW } from '../../../lib/unit-of-work/ProductUoW';

describe('UnitOfWork Concurrency', () => {
    let container: Container;
    let container2: Container;
    let pool: Pool;
    let client: PoolClient;
    let client2: PoolClient;
    let config: CosmicConfig;

    beforeAll(async () => {
        config = parentContainer.get('CosmicConfig');
        pool = new Pool(config.pg);
    });

    afterAll(async () => {
        await pool.end();
    });

    describe('pessimistic locking', () => {
        let sku: string;

        beforeEach(async () => {
            container = parentContainer.createChild();
            container2 = parentContainer.createChild();
            container.bind<CosmicConfig>('CosmicConfig').toConstantValue(
                {
                    ...config,
                    concurrencyMode: 'pessimistic',
                }
            );
            container2.bind<CosmicConfig>('CosmicConfig').toConstantValue(
                {
                    ...config,
                    concurrencyMode: 'pessimistic',
                }
            );
            sku = chance.word();
            await pool.connect().then(async (c) => {
                await c.query('BEGIN;');
                await c.query(`
                    INSERT INTO product (sku, description, version)
                    VALUES ($1, $2, $3);
                `, [sku, 'test', 0]);
                await c.query('COMMIT;');
                await c.release();
            });
            client = await new Pool(config.pg).connect();
            client2 = await new Pool(config.pg).connect();
            container.bind('AggregateClient').toConstantValue(client);
            container2.bind('AggregateClient').toConstantValue(client2);
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);
            container2.bind<IProductRepo>('ProductRepo').to(ProductRepo);
        });

        afterEach(async () => {
            await pool.connect().then(async (c) => {
                await c.query('BEGIN;');
                await c.query('DELETE FROM product WHERE sku = $1;', [sku]);
                await c.query('COMMIT;');
                await c.release();
            });
        });

        it('should lock', async () => {
            const uow: ProductUoW = container.get('ProductUoW');
            const uow2: ProductUoW = container2.get('ProductUoW');
            const start = Date.now();
            let transactionOneTime: number = 0;
            let transactionTwoTime: number = 0;
            uow.transaction(
                sku,
                (p) => {
                    p.updateDescription('description');
                    // eslint-disable-next-line no-constant-condition
                    const start = Date.now();
                    let now = start;
                    while (now - start < 2000) {
                        now = Date.now();
                    }
                    transactionOneTime = Date.now() - start;
                },
            );

            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });
            
            const res = await uow2.transaction(
                sku,
                (p) => {
                    p.updateDescription('new description');
                    transactionTwoTime = Date.now() - start;
                },
            );

            expect(res.version).toBe(2);
            expect(res.description).toBe('new description');

            expect(transactionOneTime).toBeGreaterThan(200);
            expect(transactionTwoTime).toBeGreaterThan(transactionOneTime);
        }, 10_000);
    });

    describe('optimistic locking', () => {
        let sku: string;

        beforeEach(async () => {
            container = parentContainer.createChild();
            container2 = parentContainer.createChild();
            container.bind<CosmicConfig>('CosmicConfig').toConstantValue(
                {
                    ...config,
                    concurrencyMode: 'optimistic',
                }
            );
            container2.bind<CosmicConfig>('CosmicConfig').toConstantValue(
                {
                    ...config,
                    concurrencyMode: 'optimistic',
                }
            );
            sku = chance.word();
            await pool.connect().then(async (c) => {
                await c.query('BEGIN;');
                await c.query(`
                    INSERT INTO product (sku, description, version)
                    VALUES ($1, $2, $3);
                `, [sku, 'test', 0]);
                await c.query('COMMIT;');
                await c.release();
            });
            client = await new Pool(config.pg).connect();
            client2 = await new Pool(config.pg).connect();
            container.bind('AggregateClient').toConstantValue(client);
            container2.bind('AggregateClient').toConstantValue(client2);
            container.bind<IProductRepo>('ProductRepo').to(ProductRepo);
            container2.bind<IProductRepo>('ProductRepo').to(ProductRepo);
        });

        afterEach(async () => {
            await pool.connect().then(async (c) => {
                await c.query('BEGIN;');
                await c.query('DELETE FROM product WHERE sku = $1;', [sku]);
                await c.query('COMMIT;');
                await c.release();
            });
        });

        it('should fail due to concurrent update', async () => {
            const uow: ProductUoW = container.get('ProductUoW');
            const uow2: ProductUoW = container2.get('ProductUoW');
            try {
                await Promise.all([
                    uow.transaction(
                        sku,
                        (p) => {
                            p.updateDescription('another value');
                            const start = Date.now();
                            let now = start;
                            while (now - start < 3000) {
                                now = Date.now();
                            }
                        },
                    ),
                    uow2.transaction(
                        sku,
                        (p) => {
                            const start = Date.now();
                            let now = start;
                            while (now - start < 200) {
                                now = Date.now();
                            }
                            p.updateDescription('new description');
                        },
                    ),
                ]);
                throw new Error('Should not reach here');
            } catch (e: any) {
                expect(e.message).toBe('could not serialize access due to concurrent update');
                const res = await pool.query('SELECT * FROM product WHERE sku = $1;', [sku]);
                expect(res.rows[0].version).toBe(1);
                expect(
                    ['new description', 'another value'].includes(res.rows[0].description)
                ).toBe(true);
            }
            
        }, 10_000);
    });
});