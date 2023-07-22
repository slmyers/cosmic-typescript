import 'reflect-metadata';
import Chance from 'chance';
import { Container } from 'inversify';
import { ICosmicConfig, CosmicConfig } from '../config/cosmic';
import * as fs from 'fs';
import * as path from 'path';
import { IProductRepo } from '../lib/repository/ProductRepo';
import { FakeProductRepo } from '../lib/repository/fakes/ProductRepo';
import { IBatch, Batch, IOrderLine, OrderLine, IProduct } from '../lib/domain/Product';
// import { BatchService } from '../packages/service/Batch.service';

const container = new Container();
container.bind<ICosmicConfig>('CosmicConfig').toConstantValue(
    bootstrapCosmicConfig()
);
container.bind<IProductRepo>('ProductRepo').to(FakeProductRepo);
// container.bind<BatchService>(BatchService).to(BatchService);
container.bind<IProduct[]>('fakeProducts').toConstantValue([]);

interface IChance extends Chance.Chance {
    batch: (defaults?: object) => IBatch;
    orderLine: (defaults?: object) => IOrderLine;
    product: (defaults?: object) => IProduct;
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
        return {
            sku: props.sku,
            description: props.description,
            batches: props.batches,
            version: props.version,
            allocate: jest.fn(),
            canAllocate: jest.fn(),
        };
    },
});

export { container, chance };

function bootstrapCosmicConfig(): ICosmicConfig {
    process.env.NODE_ENV = 'test';
    const env = process.env.NODE_ENV || 'dev';
    const jsonConfig = fs.readFileSync(path.join(__dirname, '..', 'database.json'), 'utf8');
    const poolConfig = JSON.parse(jsonConfig)[env];
    return new CosmicConfig(poolConfig, env, 'optimistic');
}