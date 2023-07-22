import { PoolConfig } from 'pg';

export interface ICosmicConfig {
    pg: PoolConfig;
    env: string;
}
export class CosmicConfig implements ICosmicConfig {
    constructor(
        public pg: PoolConfig,
        public env: string,
        public concurrencyMode: 'optimistic' | 'pessimistic' = 'optimistic',
    ) {}
}