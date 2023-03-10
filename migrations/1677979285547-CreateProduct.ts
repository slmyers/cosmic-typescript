import { MigrationInterface, QueryRunner } from 'typeorm';

const dbType = String(process.env.DB_TYPE);

export class CreateProduct1677979285547 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (dbType === 'sqlite') {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS product (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sku           TEXT    NOT NULL,
                    created       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    modified      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    version      INTEGER NOT NULL DEFAULT 0,
                    constraint UQ_product_sku unique (sku)
                );
            `);

            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS IDX_product_sku ON product (sku);
            `);

            await queryRunner.query(`
                CREATE TRIGGER IF NOT EXISTS product_version_constraint
                BEFORE UPDATE ON product
                BEGIN
                    SELECT 
                        CASE
                            WHEN (SELECT version from product where id = old.id) <> new.version THEN RAISE(ABORT, 'version mismatch')
                        END;
                END;
            `);

            await queryRunner.query(`
                CREATE TRIGGER IF NOT EXISTS product_version_update
                AFTER UPDATE ON product
                BEGIN
                    UPDATE product SET version = version + 1 WHERE id = old.id;
                END;
            `);
        } else if (dbType === 'postgres') {
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS product (
                    id SERIAL PRIMARY KEY,
                    sku           TEXT    NOT NULL,
                    created       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    modified      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    version      INTEGER DEFAULT 0 NOT NULL,
                    constraint UQ_product_sku unique (sku)
                )
            `);
            await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS IDX_product_sku ON product (sku);
            `);

            await queryRunner.query(`
                CREATE OR REPLACE FUNCTION product_version_update()
                    RETURNS trigger AS
                $BODY$
                BEGIN
                    new.version := old.version + 1;
                    RETURN new;
                END;
                $BODY$
                LANGUAGE plpgsql;


                CREATE TRIGGER product_version_update_trigger
                BEFORE UPDATE ON product
                FOR EACH ROW EXECUTE FUNCTION product_version_update();
            `);

            await queryRunner.query(`
            CREATE OR REPLACE FUNCTION product_version_constraint()
                RETURNS trigger AS
            $BODY$
            BEGIN
                SELECT 
                    CASE
                        WHEN (SELECT version from product where id = old.id) <> new.version THEN RAISE(ABORT, 'version mismatch')
                    END;
                RETURN new;
            END;
            $BODY$
            LANGUAGE plpgsql;


            CREATE TRIGGER product_version_constraint_trigger
            BEFORE UPDATE ON product
            FOR EACH ROW EXECUTE FUNCTION product_version_constraint();
            `);
        } else {
            throw new Error(`DB_TYPE ${dbType} not supported`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS product;');
    }
}
