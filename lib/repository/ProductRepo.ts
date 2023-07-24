import { QueryResult } from 'pg';
import { injectable } from 'inversify';
import { IProduct, Batch, OrderLine, Product, IBatch, IOrderLine } from '../domain/Product';

export interface IProductClient {
    query: (query: string, params?: any[]) => Promise<QueryResult>;
}

export interface IProductRepo {
    allocate(batchReference: string, orderLine: IOrderLine, client: IProductClient): Promise<string>;
    deallocate(batchReference: string, orderLine: IOrderLine, client: IProductClient): Promise<void>;
    updateVersion(sku: string, version: number, client: IProductClient): Promise<void>;
    updateDescription(sku: string, description: string, client: IProductClient): Promise<void>;
    load(sku: string, client: IProductClient): Promise<IProduct>;
}

export interface IProductDiff {
    original: IProduct;
    updated: IProduct;
}

@injectable()
export class ProductRepo implements IProductRepo {

    async allocate(batchReference: string, orderLine: IOrderLine, client: IProductClient): Promise<string> {
        const result = await client.query(
            'INSERT INTO order_line (order_id, batch_reference, sku, qty) VALUES ($1, $2, $3, $4) RETURNING order_id',
            [
                orderLine.orderId,
                batchReference,
                orderLine.sku,
                orderLine.qty,
            ]
        );

        return result.rows[0].order_id;
    }

    async deallocate(batchReference: string, orderLine: IOrderLine, client: IProductClient): Promise<void> {
        await client.query(
            'DELETE FROM order_line WHERE batch_reference = $1 AND order_id = $2',
            [
                batchReference,
                orderLine.orderId,
            ]
        );
    }

    async updateVersion(sku: string, version: number, client: IProductClient): Promise<void> {
        await client.query(
            'UPDATE product SET version = $1 WHERE sku = $2',
            [
                version,
                sku,
            ]
        );
    }

    async updateDescription(sku: string, description: string, client: IProductClient): Promise<void> {
        await client.query(
            'UPDATE product SET description = $1 WHERE sku = $2',
            [
                description,
                sku,
            ]
        );
    }

    async load(sku: string, client: IProductClient): Promise<IProduct> {
        const result = await client.query(
            `
            ${this.retrievalCTE}
            SELECT
                p.sku,
                p.description,
                p.version,
                coalesce(json_agg(batches.batch), '[]') as batches,
                coalesce(json_agg(orders.allocation), '[]') as allocations
            FROM prod p
            LEFT OUTER JOIN batches ON batches.sku = p.sku
            LEFT OUTER JOIN orders ON orders.reference = batches.reference
            GROUP BY p.sku, p.description, p.version;
            `,
            [
                sku,
            ]
        );

        if (result.rows.length === 0) {
            throw new Error('Product not found: ' + sku);
        }
        return this.fromDb(result);
    }

    private fromDb(queryResult: QueryResult): IProduct  {
        const rawProduct = queryResult.rows[0];
        const batches = rawProduct.batches.flat()
            // null results from joins
            .filter((b: any) => b !== null && b !== undefined && b !== 'null' && b !== 'undefined' && b !== '{}')
            .filter((b: IBatch) => b.reference !== null && b.reference !== undefined)
            .map((b: any) => new Batch(
                b.reference,
                b.sku,
                b.available_quantity,
                new Date(b.eta)
            ));

        const allocations = rawProduct.allocations.flat()
            // null results from joins
            .filter((a: any) => a !== null && a !== undefined && a !== 'null' && a !== 'undefined' && a !== '{}')
            .filter((a: any) => a.orderId !== null && a.orderId !== undefined);

        const product = new Product(
            rawProduct.sku,
            rawProduct.description,
            batches,
            rawProduct.version
        );

        for (const allocation of allocations) {
            const batch = product.batches.find(b => b.reference === allocation.batchReference);
            if (batch) {
                batch.allocate(new OrderLine(
                    allocation.orderId,
                    allocation.sku,
                    allocation.qty
                ));
            } else {
                throw new Error('Batch not found: ' + allocation.reference);
            }
        }

        return product;
    }
    get retrievalCTE() {
        return `
            with prod as (
                SELECT * FROM product WHERE sku = $1
            ),
            batches as (
                SELECT
                    b.sku,
                    b.reference,
                    json_agg(json_build_object(
                        'reference', b.reference,
                        'sku', b.sku,
                        'available_quantity', b.max_quantity,
                        'eta', b.eta
                    )) as batch
                FROM batch b
                LEFT JOIN prod p ON p.sku = b.sku
                GROUP BY b.sku, b.reference
            ),
            orders as (
                SELECT
                    b.reference,
                    json_agg(json_build_object(
                        'orderId', ol.order_id,
                        'sku', ol.sku,
                        'qty', ol.qty,
                        'batchReference', ol.batch_reference
                    )) as allocation
                FROM batch b
                LEFT JOIN order_line ol ON ol.batch_reference = b.reference
                GROUP BY b.reference
            )
        `;
    }
}