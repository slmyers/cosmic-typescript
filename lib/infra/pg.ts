import { Pool as PgPool, PoolClient } from 'pg';
import { ICosmicConfig } from '../../config/cosmic';
import { inject, injectable, preDestroy } from 'inversify';

export interface IPool {
    getAlias(): string;
    connect: () => Promise<PoolClient>;
    end: () => Promise<void>;
}

@injectable()
export class Pool implements IPool {
    private pool: PgPool;

    constructor(
        @inject('CosmicConfig') private config: ICosmicConfig
    ) {
        this.pool = new PgPool(this.config.pg);
    }

    async connect(): Promise<PoolClient> {
        return this.pool.connect();
    }

    async query(text: string, params?: any[]): Promise<any[]> {
        const { rows } = await this.pool.query(text, params);
        return rows;
    }

    async transaction(fn: (client: PoolClient) => Promise<any>): Promise<any> {
        const client = await this.pool.connect();
        let result;
        try {
            await client.query('BEGIN');
            result = await fn(client);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
        return result;
    }

    end(): Promise<void> {
        return this.pool.end();
    }

    getAlias(): string {
        return '';
    }

    @preDestroy()
    destroy() {
        this.end();
    }
}