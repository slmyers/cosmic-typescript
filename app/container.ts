import 'reflect-metadata';
import fs from 'fs';
import path from 'path';
import { Container } from 'inversify';

import { ICosmicConfig, CosmicConfig } from '../config/cosmic';
import { IProductRepo, ProductRepo } from '../lib/repository/ProductRepo';
import { IMessageBus, MessageBusService } from '../lib/service/MessageBusService';
import { IProductUoW, ProductUoW } from '../lib/unit-of-work/ProductUoW';
import { Pool } from '../lib/infra/pg';
import { IMessageHandlers, MessageHandlers } from '../lib/service/MessageHandlers';

const config = bootstrapCosmicConfig();
const pool = new Pool(config);

const parentContainer = new Container();
parentContainer.bind<ICosmicConfig>('CosmicConfig').toConstantValue(config);
parentContainer.bind<IProductRepo>('ProductRepo').to(ProductRepo);
parentContainer.bind<IProductUoW>('ProductUoW').to(ProductUoW);
parentContainer.bind<IMessageBus>('MessageBusService').to(MessageBusService);
parentContainer.bind<IMessageHandlers>('MessageHandlers').to(MessageHandlers);

function bootstrapCosmicConfig(): ICosmicConfig {
    process.env.NODE_ENV = 'test';
    const env = process.env.NODE_ENV || 'dev';
    const jsonConfig = fs.readFileSync(path.join(__dirname, '..', 'database.json'), 'utf8');
    const poolConfig = JSON.parse(jsonConfig)[env];
    return new CosmicConfig(poolConfig, env, 'optimistic');
}


export async function assignContainer() {
    const container = parentContainer.createChild();
    const client = await pool.connect();

    container.bind('AggregateClient').toConstantValue(client);

    return container;
}