import 'reflect-metadata';
import Chance from 'chance';
import { Container } from 'inversify';
import { ICosmicConfig, CosmicConfig } from '../config/cosmic';
import * as fs from 'fs';
import * as path from 'path';
import { IProductRepo } from '../lib/repository/ProductRepo';
import { FakeProductRepo } from '../lib/repository/fakes/ProductRepo';
import { IBatch, Batch, IOrderLine, OrderLine, IProduct, Product } from '../lib/domain/Product';
import { IProductEvent } from '../lib/domain/ProductEvent';

import {enableMapSet, enablePatches} from 'immer';
import { IProductAggregateClient, ProductUoW, IProductUoW } from '../lib/unit-of-work/ProductUoW';
import { IMessageBus, MessageBusService } from '../lib/service/MessageBusService';
import { IMessageHandlers, MessageHandlers } from '../lib/service/MessageHandlers';

enablePatches();
enableMapSet();

const parentContainer = new Container();
parentContainer.bind<ICosmicConfig>('CosmicConfig').toConstantValue(
    bootstrapCosmicConfig()
);
parentContainer.bind<IProductRepo>('ProductRepo').to(FakeProductRepo);
parentContainer.bind<IProduct[]>('fakeProducts').toConstantValue([]);
parentContainer.bind<IProductUoW>('ProductUoW').to(ProductUoW);
parentContainer.bind<IMessageBus>('MessageBusService').to(MessageBusService);
parentContainer.bind<IMessageHandlers>('MessageHandlers').to(MessageHandlers);

interface IChance extends Chance.Chance {
    batch: (defaults?: object) => IBatch;
    orderLine: (defaults?: object) => IOrderLine;
    product: (defaults?: object) => IProduct;
    client: (defaults?: object) => IProductAggregateClient;
    messageBus: (defaults?: object) => IMessageBus;
    productEvent: (defaults?: object) => IProductEvent;
    container: () => Container;
}

const chance = new Chance() as IChance;
chance.mixin({
    batch: function(defaults = {}): IBatch {
        const props = Object.assign({
            reference: chance.guid(),
            sku: chance.string(),
            available_quantity: chance.integer({ min: 1, max: 100 }),
            eta: chance.date(),
        }, defaults);
        return new Batch(
            props.reference,
            props.sku,
            props.available_quantity,
            props.eta
        );
    },
    orderLine: function(defaults = {}): IOrderLine {
        const props = Object.assign({
            orderId: chance.guid(),
            sku: chance.string(),
            qty: chance.integer({ min: 1, max: 100 }),
        }, defaults);
        return new OrderLine(props.orderId, props.sku, props.qty);
    },
    product: function(defaults = {}): IProduct {
        const props = Object.assign({
            sku: chance.string(),
            description: chance.string(),
            batches: [],
            version: 1,
        }, defaults);
        return new Product(
            props.sku,
            props.description,
            props.batches,
            props.version,
        );
    },
    client: function(defaults = {}): IProductAggregateClient {
        const props = Object.assign({
            release: jest.fn(),
            begin: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            query: jest.fn(),
            connect: jest.fn(),
        }, defaults);
        return props;
    },
    messageBus: function(defaults = {}): IMessageBus {
        const props = Object.assign({
            publish: jest.fn(),
        }, defaults);
        return props;
    },
    productEvent: function(defaults = {}): IProductEvent {
        const props = Object.assign({
            sku: chance.string(),
            description: chance.string(),
            version: chance.integer({ min: 1, max: 100 }),
        }, defaults);
        return props;
    },
    container: function(): Container {
        return parentContainer.createChild();
    },
});

function bootstrapCosmicConfig(): ICosmicConfig {
    process.env.NODE_ENV = 'test';
    const env = process.env.NODE_ENV || 'dev';
    const jsonConfig = fs.readFileSync(path.join(__dirname, '..', 'database.json'), 'utf8');
    const poolConfig = JSON.parse(jsonConfig)[env];
    return new CosmicConfig(poolConfig, env, 'optimistic');
}

function setupContainer(container: Container, values: any): Container {
    for (const [key, value] of Object.entries(values)) {
        container.bind(key).toConstantValue(value);
    }

    return container;
}

export { parentContainer, chance, setupContainer };