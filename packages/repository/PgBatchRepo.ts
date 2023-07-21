import { inject } from 'inversify';
import { BatchRepo, IBatchRepo } from './BatchRepo';
import { Pool } from '../infra/pg';
import { Batch, IBatch, IOrderLine, OrderLine } from '../domain/Batch';
import { QueryResult } from 'pg';


export class PgBatchRepo extends BatchRepo implements IBatchRepo {

    constructor(
        @inject(Pool) private pool: Pool,
    ) {
        super();
    }

    async add(batch: IBatch): Promise<string> {
        return await this.pool.transaction(async (client) => {
            const result = await client.query(
                'INSERT INTO batch (sku, max_quantity, eta) VALUES ($1, $2, $3) RETURNING reference',
                [batch.sku, batch.available_quantity, batch.eta]
            );
            return result.rows[0].reference;
        });
    }

    async get(ref: string): Promise<IBatch> {
        // typings say pool#query returns a Promise<any[]> but I'm seeing a Promise<QueryResult>
        const res: unknown = await this.pool.query(
            `SELECT 
                b.reference,
                b.sku,
                b.max_quantity,
                b.eta,
                json_agg(json_build_object(
                    'orderId', ol.order_id,
                    'sku', ol.sku,
                    'qty', ol.qty
                )) as allocations
                FROM batch b
                LEFT JOIN order_line ol ON ol.batch_reference = b.reference
                WHERE b.reference = $1
                GROUP BY b.reference, b.sku, b.max_quantity, b.eta
            `,
            [ref]
        );

        return this.fromDb(
            (res as QueryResult).rows[0]
        );
    }

    async load(limit: number): Promise<IBatch[]> {
        // typings say pool#query returns a Promise<any[]> but I'm seeing a Promise<QueryResult>
        const res: unknown = await this.pool.query(`
            with batches as (
                SELECT
                    b.reference,
                    b.sku,
                    b.max_quantity,
                    b.eta
                FROM batch b
                LIMIT $1
            ),
            orders as (
                SELECT
                    b.reference,
                    json_agg(json_build_object(
                        'orderId', ol.order_id,
                        'sku', ol.sku,
                        'qty', ol.qty
                    )) as allocations
                FROM batches b
                LEFT JOIN order_line ol ON ol.batch_reference = b.reference
                GROUP BY b.reference
            )
            SELECT
                b.reference,
                b.sku,
                b.max_quantity,
                b.eta,
                o.allocations
            FROM batches b
            LEFT JOIN orders o ON o.reference = b.reference;
        `,
        [limit]
        );

        const batches = (res as QueryResult).rows;

        return batches.map(this.fromDb.bind(this));
    }

    async allocate(ref: string, line: IOrderLine): Promise<string> {
        return await this.pool.transaction(async (client) => {
            await client.query(
                'INSERT INTO order_lines (batch_reference, sku, quantity) VALUES ($1, $2, $3) RETURNING id',
                [ref, line.sku, line.qty]
            );
            return ref;
        });
    }

    private fromDb(o: object): IBatch {
        const b = new Batch(
            o['reference'],
            o['sku'],
            o['max_quantity'],
            o['eta']
        );

        for (const allocation of o['allocations']) {
            if (allocation['orderId'] === null) continue;

            b.allocate(
                new OrderLine(
                    allocation['orderId'],
                    allocation['sku'],
                    allocation['qty']
                )
            );
        }

        return b;
    }
}