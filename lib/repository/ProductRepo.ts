import { injectable } from 'inversify';
import { IProduct, IOrderLine, Batch, OrderLine, Product, IBatch } from '../domain/Product';
import { PoolClient, QueryResult } from 'pg';

export interface IProductRepo {
    add(product: IProduct): Promise<string>;
    get(sku: string): Promise<IProduct>;
    allocate(batch: IBatch, line: IOrderLine): Promise<string>;
    addBatch(batch: IBatch): Promise<string>;
}

@injectable()
export class ProductRepo implements IProductRepo {

    constructor(private client: PoolClient) {}

    async add(product: IProduct): Promise<string> {
        const result = await this.client.query(
            'INSERT INTO product (sku, description, version) VALUES ($1, $2, 1) RETURNING sku',
            [product.sku, product.description]
        );
        return result.rows[0].sku;
    }

    async addBatch(batch: IBatch): Promise<string> {
        const productExists = await this.client.query(
            'SELECT sku FROM product WHERE sku = $1',
            [batch.sku]
        );

        if (productExists.rows.length === 0) {
            throw new Error('Product not found: ' + batch.sku);
        }

        const result = await this.client.query(
            `
                INSERT INTO batch (sku, reference, max_quantity, eta) 
                VALUES ($1, $2, $3, $4)
                RETURNING reference;
            `,
            [batch.sku, batch.reference, batch.available_quantity, batch.eta]
        );
        return result.rows[0].reference;
    }

    get retrievalCTE() {
        return `
            with product as (
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
                INNER JOIN product p ON p.sku = b.sku
                GROUP BY b.sku, b.reference
            ),
            orders as (
                SELECT
                    b.reference,
                    json_agg(json_build_object(
                        'orderId', ol.order_id,
                        'sku', ol.sku,
                        'qty', ol.qty
                    )) as allocation
                FROM batch b
                LEFT JOIN order_line ol ON ol.batch_reference = b.reference
                GROUP BY b.reference
            )
        `;
    }

    async get(sku: string): Promise<IProduct> {
        const result = await this.client.query(
            `
            ${this.retrievalCTE}
            SELECT
                p.sku,
                p.description,
                p.version,
                coalesce(json_agg(batches.batch), '[]') as batches,
                coalesce(json_agg(orders.allocation), '[]') as allocations
            FROM product p
            FULL OUTER JOIN batches ON batches.sku = p.sku
            FULL OUTER JOIN orders ON orders.reference = batches.reference
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

    async allocate(batch: IBatch, line: IOrderLine): Promise<string> {
        const constraint = await this.client.query(
            `
            SELECT
                max_quantity
                , coalesce(sum(ol.qty), 0) as total_allocated
                , p.sku
                , b.sku as batch_sku
            FROM batch b
            LEFT JOIN order_line ol ON ol.batch_reference = b.reference
            LEFT JOIN product p ON p.sku = b.sku
            WHERE b.reference = $1
            AND b.sku = $2
            GROUP BY b.reference, b.max_quantity, p.sku, b.sku
            `,
            [batch.reference, line.sku]
        );

        const { total_allocated, max_quantity, sku, batch_sku } = constraint.rows[0] || { total_allocated: 0, max_quantity: 0 };
        
        if (!(sku && batch_sku)) {
            throw new Error('sku not found: ' + line.sku);
        }

        if (total_allocated + line.qty > max_quantity) {
            throw new Error(`Out of stock: ${line.sku}`);
        }

        await this.client.query(
            'INSERT INTO order_line (order_id, sku, qty, batch_reference) VALUES ($1, $2, $3, $4)',
            [line.orderId, line.sku, line.qty, batch.reference]
        );
        
        return batch.reference;
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
            .filter((a: any) => a.orderId !== null && a.orderId !== undefined)
            .map((a: any) => new OrderLine(
                a.orderId,
                a.sku,
                a.qty
            ));

        const product = new Product(
            rawProduct.sku,
            rawProduct.description,
            batches,
            rawProduct.version
        );

        allocations.forEach(a => {
            if (!product.canAllocate(a)) {
                throw new Error('Cannot allocate: ' + JSON.stringify(a) + ' to ' + JSON.stringify(product) + '');
            }
            product.allocate(a);
        });

        return product;
    }
}