import * as Hapi from '@hapi/hapi';
import {enableMapSet, enablePatches} from 'immer';
import { Container } from 'inversify';

import { IProductService } from '../lib/service/ProductService';
import { IOrderLine, OrderLine } from '../lib/domain/Product';
import { assignContainer } from './container';


init();

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

async function init() {
    enablePatches();
    enableMapSet();
    
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
            const container: Container = await assignContainer();

            try {
                const service = container.get<IProductService>('ProductService');
                await service.allocate(request.params.sku, order);
                return h.response().code(204);
            } catch (e: any) {
                console.log(e);
                return h.response(e.message).code(500);
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

            try {
                const container: Container = await assignContainer();
                const service = container.get<IProductService>('ProductService');
                await service.deallocate(sku, orderId);
                return h.response().code(204);
            } catch (e: any) {
                console.log(e);
                return h.response(e.message).code(500);
            }
        }
    });

    await server.start();
    console.log('Server running on %s', server.info.uri);
}







