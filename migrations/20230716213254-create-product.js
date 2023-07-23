'use strict';


/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function() {};

exports.up = function(db) {
    return db.runSql(`
        CREATE TABLE product (
            id SERIAL PRIMARY KEY,
            sku VARCHAR(255) NOT NULL,
            description VARCHAR(255) NOT NULL,
            version INT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT product_sku_unique UNIQUE (sku)
        );

        CREATE INDEX product_sku_idx ON product (sku);
        
        CREATE INDEX product_sku_version_idx ON product (sku, version);

        ALTER TABLE batch ADD CONSTRAINT batch_sku_fkey FOREIGN KEY (sku) REFERENCES product(sku);
        ALTER TABLE order_line ADD CONSTRAINT order_line_sku_fkey FOREIGN KEY (sku) REFERENCES product(sku);
    `);
};

exports.down = function() {
    return null;
};

exports._meta = {
    'version': 1
};
