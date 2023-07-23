'use strict';

exports.setup = function() {};

exports.up = function(db) {
    return db.runSql(`
        CREATE TABLE batch (
            id SERIAL PRIMARY KEY,
            reference UUID NOT NULL DEFAULT uuid_generate_v4(),
            sku VARCHAR(255) NOT NULL,
            max_quantity INT NOT NULL,
            eta TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT batch_reference_unique UNIQUE (reference)
        );

        CREATE INDEX batch_sku_idx ON batch (sku);
        CREATE INDEX batch_reference_idx ON batch (reference);

        CREATE TABLE order_line (
            id SERIAL PRIMARY KEY,
            order_id UUID NOT NULL,
            sku VARCHAR(255) NOT NULL,
            qty INT NOT NULL,
            batch_reference UUID NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            FOREIGN KEY (batch_reference) REFERENCES batch(reference)
        );

        CREATE INDEX order_line_order_id_idx ON order_line (order_id);
        CREATE INDEX order_line_sku_idx ON order_line (sku);
        CREATE INDEX order_line_batch_reference_idx ON order_line (batch_reference);
    `);
};

exports.down = function() {
    return null;
};

exports._meta = {
    'version': 1
};
