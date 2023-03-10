import { expect } from 'chai';
import { Batch, allocate, OrderLine } from '$model/index';

describe('Batch Domain', function () {
    describe('can allocate', function () {
        let batch: Batch;
        let line: OrderLine;

        this.beforeEach(function () {
            // create a batch
            batch = new Batch('batch-001', 'SMALL-TABLE', 20, new Date());
        });

        it('can allocate if available equal required', function () {
            line = new OrderLine('SMALL-TABLE', batch.availableQuantity);
            expect(batch.canAllocate(line)).to.be.true;
        });

        it('can allocate if available more than required', function () {
            line = new OrderLine('SMALL-TABLE', batch.availableQuantity - 1);
            expect(batch.canAllocate(line)).to.be.true;
        });

        it('cannot allocate more items than available', function () {
            line = new OrderLine('SMALL-TABLE', batch.availableQuantity + 1);
            expect(batch.canAllocate(line)).to.be.false;
        });

        it('cannot allocate if sku does not match', function () {
            line = new OrderLine('LARGE-TABLE', batch.availableQuantity);
            expect(batch.canAllocate(line)).to.be.false;
        });
    });

    describe('batch allocation', function () {
        let batch: Batch;
        let line: OrderLine;

        this.beforeEach(function () {
            // create a Batch
            batch = new Batch('batch-001', 'SMALL-TABLE', 20, new Date());
        });

        it('can allocate if available equal required', function () {
            line = new OrderLine('SMALL-TABLE', batch.availableQuantity);
            batch.allocate(line);
            expect(batch.availableQuantity).to.equal(0);
        });

        it('cannot allocate the same line more than once', function () {
            line = new OrderLine('SMALL-TABLE', batch.availableQuantity);
            batch.allocate(line);
            batch.allocate(line);
            expect(batch.availableQuantity).to.equal(0);
        });

        it('cannot allocate more than available', function () {
            line = new OrderLine('SMALL-TABLE', batch.availableQuantity + 1);
            batch.allocate(line);
            expect(batch.availableQuantity).to.equal(20);
        });
    });

    describe('equals', function () {
        let batch: Batch;
        let otherBatch: Batch;

        this.beforeEach(function () {
            // create a batch
            batch = new Batch('batch-001', 'SMALL-TABLE', 20, new Date());
        });

        it('is equal if reference is the same', function () {
            otherBatch = new Batch('batch-001', 'SMALL-TABLE', 20, new Date());
            expect(batch.equals(otherBatch)).to.be.true;
        });

        it('is equal if the order lines are the same', function () {
            otherBatch = new Batch('batch-001', 'SMALL-TABLE', 20, new Date());
            const orderLine = new OrderLine('SMALL-TABLE', 1);
            otherBatch.allocate(orderLine);
            batch.allocate(orderLine);
            expect(batch.equals(otherBatch)).to.be.true;
        });

        it('is not equal if reference is different', function () {
            otherBatch = new Batch('batch-002', 'SMALL-TABLE', 20, new Date());
            expect(batch.equals(otherBatch)).to.be.false;
        });

        it('is not equal if sku is different', function () {
            otherBatch = new Batch('batch-001', 'LARGE-TABLE', 20, new Date());
            expect(batch.equals(otherBatch)).to.be.false;
        });

        it('is not equal if the order line is different', function () {
            otherBatch = new Batch('batch-001', 'SMALL-TABLE', 20, new Date());
            const orderLine = new OrderLine('SMALL-TABLE', 1);
            expect(otherBatch.canAllocate(orderLine)).to.be.true;
            otherBatch.allocate(orderLine);
            expect(batch.equals(otherBatch)).to.be.false;
        });
    });

    describe('priority', function () {
        let batch: Batch;
        let otherBatch: Batch;

        this.beforeEach(function () {
            // create a batch
            batch = new Batch(
                'batch-001',
                'SMALL-TABLE',
                20,
                new Date(1990, 1, 1),
            );
        });

        it('is higher priority if eta is earlier', function () {
            otherBatch = new Batch(
                'batch-002',
                'SMALL-TABLE',
                20,
                new Date(2000, 1, 1),
            );
            expect(batch.priority(otherBatch)).to.equal(-1);
        });

        it('is lower priority if eta is later', function () {
            otherBatch = new Batch(
                'batch-002',
                'SMALL-TABLE',
                20,
                new Date(1980, 1, 1),
            );
            expect(batch.priority(otherBatch)).to.equal(1);
        });

        it('is higher priority if eta is the same but other has greater available quantity', function () {
            otherBatch = new Batch(
                'batch-002',
                'SMALL-TABLE',
                21,
                new Date(1990, 1, 1),
            );
            expect(batch.priority(otherBatch)).to.equal(-1);
        });

        it('is lower priority if eta is the same but other has less available quantity', function () {
            otherBatch = new Batch(
                'batch-002',
                'SMALL-TABLE',
                19,
                new Date(1990, 1, 1),
            );
            expect(batch.priority(otherBatch)).to.equal(1);
        });

        it('is equal priority if eta and available quantity are the same', function () {
            otherBatch = new Batch(
                'batch-002',
                'SMALL-TABLE',
                20,
                new Date(1990, 1, 1),
            );
            expect(batch.priority(otherBatch)).to.equal(0);
        });
    });

    describe('allocate', function () {
        let batch: Batch;
        let line: OrderLine;
        let expectedReference: string;

        this.beforeEach(function () {
            // create a batch
            batch = new Batch('batch-001', 'SMALL-TABLE', 20, new Date());
            expectedReference = batch.reference;
        });

        it('allocates a line', function () {
            line = new OrderLine('SMALL-TABLE', 2);
            const result = allocate(line, [batch]);
            expect(batch.availableQuantity).to.equal(18);
            expect(result).to.equal(expectedReference);
        });

        it('can allocate if available equal required', function () {
            line = new OrderLine('SMALL-TABLE', batch.availableQuantity);
            const result = allocate(line, [batch]);
            expect(batch.availableQuantity).to.equal(0);
            expect(result).to.equal(expectedReference);
        });

        it('can allocate if available more than required', function () {
            line = new OrderLine('SMALL-TABLE', batch.availableQuantity - 1);
            const result = allocate(line, [batch]);
            expect(batch.availableQuantity).to.equal(1);
            expect(result).to.equal(expectedReference);
        });

        it('cannot allocate more items than available', function () {
            line = new OrderLine('SMALL-TABLE', batch.availableQuantity + 1);
            const result = allocate(line, [batch]);
            expect(batch.availableQuantity).to.equal(20);
            expect(result).to.equal('');
        });

        it('cannot allocate if sku does not match', function () {
            line = new OrderLine('LARGE-TABLE', batch.availableQuantity);
            const result = allocate(line, [batch]);
            expect(batch.availableQuantity).to.equal(20);
            expect(result).to.equal('');
        });
    });

    describe('deallocate', function () {
        let batch: Batch;
        let line: OrderLine;

        this.beforeEach(function () {
            // create a batch
            batch = new Batch('batch-001', 'SMALL-TABLE', 20, new Date());
        });

        it('deallocate a line', function () {
            line = new OrderLine('SMALL-TABLE', 2);
            batch.allocate(line);
            batch.deallocate(line);
            expect(batch.availableQuantity).to.equal(20);
        });
    });
});
