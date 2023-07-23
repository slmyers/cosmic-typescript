import 'reflect-metadata';
import path from 'path';
import fs from 'fs';
import * as Hapi from '@hapi/hapi';
import { Container } from 'inversify';
import { ICosmicConfig, CosmicConfig } from '../config/cosmic';
import { Pool } from '../lib/infra/pg';
import { IProductRepo, ProductRepo } from '../lib/repository/ProductRepo';
import { IProductService, ProductService } from '../lib/service/ProductService';
import { IProductUoW, ProductUoW } from '../lib/unit-of-work/ProductUoW';
import { IOrderLine, OrderLine } from '../lib/domain/Product';

import {enableMapSet, enablePatches} from 'immer';
enablePatches();
enableMapSet();


const init = async () => {
    const config = bootstrapCosmicConfig();
    const pool = new Pool(config);

    const parentContainer = new Container();
    parentContainer.bind<ICosmicConfig>('CosmicConfig').toConstantValue(config);
    parentContainer.bind<IProductRepo>('ProductRepo').to(ProductRepo);
    parentContainer.bind<IProductUoW>('ProductUoW').to(ProductUoW);
    parentContainer.bind<IProductService>('ProductService').to(ProductService);

    const server = Hapi.server({
        port: 3000,
        host: 'localhost'
    });

    server.route({
        method: 'POST',
        path: '/product/{sku}/orders',
        handler: async (request, h) => {
            const payload = request.payload as IOrderLine;
            const order = new OrderLine(payload.orderId, payload.sku, payload.qty);
            let client;
            try {
                client = await pool.connect();
                const container = parentContainer.createChild();
                container.bind('AggregateClient').toConstantValue(client);
    
                const service = container.get<IProductService>('ProductService');
                await service.allocate(request.params.sku, order);
                return h.response().code(204);
            } catch (e: any) {
                console.log(e);
                return h.response(e.message).code(500);
            } finally {
                if (client) {
                    client.release();
                }
            }
        },
    });

    server.route({
        method: 'DELETE',
        path: '/product/{sku}/orders/{orderId}',
        handler: async (request, h) => {
            const {
                sku,
                orderId
            } = request.params;
            let client;
            try {
                client = await pool.connect();
                const container = parentContainer.createChild();
                container.bind('AggregateClient').toConstantValue(client);
    
                const service = container.get<IProductService>('ProductService');
                await service.deallocate(sku, orderId);
                return h.response().code(204);
            } catch (e: any) {
                console.log(e);
                return h.response(e.message).code(500);
            } finally {
                if (client) {
                    client.release();
                }
            }
        },
    });

    await server.start();
    console.log('Server running on %s', server.info.uri);
};



init();


function bootstrapCosmicConfig(): ICosmicConfig {
    process.env.NODE_ENV = 'test';
    const env = process.env.NODE_ENV || 'dev';
    const jsonConfig = fs.readFileSync(path.join(__dirname, '..', 'database.json'), 'utf8');
    const poolConfig = JSON.parse(jsonConfig)[env];
    return new CosmicConfig(poolConfig, env, 'optimistic');
}

process.on('unhandledRejection', (err) => {

    console.log(err);
    process.exit(1);
});