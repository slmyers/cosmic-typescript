import { add } from 'date-fns';
import { Batch, OrderLine, allocate, OutOfStockError, Product } from '../../../lib/domain/Product';
import { chance } from '../../jest.setup';

describe('Batch Domain', () => {
    let today: Date;
    let tomorrow: Date;

    beforeEach(() => {
        today = new Date();
        tomorrow = add(today, { days: 1 });
    });

    describe('Batch Model', () => {
        it('should import', () => {
            expect(Batch).toBeDefined();
        });
    
        describe('Allocate', () => {
            it('should allocate to a batch reduces the available quantity', () => {
                const batch = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                batch.allocate(new OrderLine('order-ref', 'SMALL-TABLE', 10));
                expect(batch.available_quantity).toBe(10);
            });
    
            it('should can allocate if available greater than required', () => {
                const batch = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                expect(batch.canAllocate(new OrderLine('order-ref', 'SMALL-TABLE', 10))).toBe(true);
            });
    
            it('should cannot allocate if available smaller than required', () => {
                const batch = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                expect(batch.canAllocate(new OrderLine('order-ref', 'SMALL-TABLE', 30))).toBe(false);
            });
    
            it('should can allocate if available equal to required', () => {
                const batch = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                expect(batch.canAllocate(new OrderLine('order-ref', 'SMALL-TABLE', 20))).toBe(true);
            });
    
            it('should not allocate if skus do not match', () => {
                const batch = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                expect(batch.canAllocate(new OrderLine('order-ref', 'LARGE-TABLE', 20))).toBe(false);
            });
        });
    
        describe('Deallocate', () => {
            let max: number;
            let lesser: number;
            let batch: Batch;
    
            beforeEach(() => {
                max = chance.integer({ min: 1, max: 100 });
                lesser = chance.integer({ min: 1, max: max });
                batch = new Batch('batch-001', 'SMALL-TABLE', max, tomorrow);
            });
            
            it('should deallocate to a batch increases the available quantity', () => {
                const order = new OrderLine('order-ref', 'SMALL-TABLE', lesser);
                batch.allocate(order);
                expect(batch.available_quantity).toBe(max - lesser);
                batch.deallocate(order.orderId);
                expect(batch.available_quantity).toBe(max);
            });
    
            it('should only deallocate allocated lines', () => {
                const batch = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                const order = new OrderLine('order-ref', 'SMALL-TABLE', 10);
                batch.deallocate(order.orderId);
                expect(batch.available_quantity).toBe(20);
            });
        });
    
        describe('Equality', () => {
            it('should equal batches with the same reference and sku', () => {
                const batch1 = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                const batch2 = new Batch('batch-001', 'tall-lamp', 20, tomorrow);
                expect(batch1.__eq__(batch2)).toEqual(true);
            });
    
            it('should not equal batches with different reference', () => {
                const batch1 = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                const batch2 = new Batch('batch-002', 'SMALL-TABLE', 20, tomorrow);
                expect(batch1.__eq__(batch2)).toEqual(false);
            });
        });

        describe('Hash', () => {
            it('should hash batches with the same reference and sku', () => {
                const batch1 = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                const batch2 = new Batch('batch-001', 'tall-lamp', 20, tomorrow);
                expect(batch1.__hash__()).not.toEqual(batch2.__hash__());
            });
    
            it('should hash batches with different reference and same sku', () => {
                const batch1 = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                const batch2 = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                expect(batch1.__hash__()).toEqual(batch2.__hash__());
            });
        });
    });

    describe('allocate function', () => {
        let batches: Batch[];
        let order: OrderLine;
        it('should allocate to a batch reduces the available quantity', () => {
            batches = [
                new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow),
                new Batch('batch-002', 'SMALL-TABLE', 20, tomorrow),
            ];
            order = new OrderLine('order-ref', 'SMALL-TABLE', 10);
            const totalQty = batches.reduce((acc, batch) => acc + batch.available_quantity, 0);
            const ref = allocate(batches, order);
            expect(ref).toBeDefined();
            expect(batches.some(({reference}) => reference === ref)).toBe(true);
            expect(batches.reduce((acc, batch) => acc + batch.available_quantity, 0))
                .toBe(totalQty - order.qty);
        });

        it('should throw an error if no batch can be allocated', () => {
            batches = [
                new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow),
                new Batch('batch-002', 'SMALL-TABLE', 20, tomorrow),
            ];
            order = new OrderLine('order-ref', 'SMALL-TABLE', 30);
            expect(() => allocate(batches, order)).toThrow(OutOfStockError);
        });
    });

    describe('Product Model', () => {
        it('should import', () => {
            expect(Product).toBeDefined();
        });

        describe('Allocate', () => {
            let product: Product;
            let order: OrderLine;
            let batch: Batch;
            beforeEach(() => {
                batch = new Batch('batch-001', 'SMALL-TABLE', 20, tomorrow);
                product = new Product('SMALL-TABLE', 'Small Table', [batch], 1);
                order = new OrderLine('order-ref', 'SMALL-TABLE', 10);
            });

            it('should allocate to a batch reduces the available quantity', () => {
                product.allocate(order);
                expect(batch.available_quantity).toBe(10);
            });
    
            it('should can allocate if available greater than required', () => {
                expect(product.canAllocate(order)).toBe(true);
            });
    
            it('should cannot allocate if available smaller than required', () => {
                const order = new OrderLine('order-ref', 'SMALL-TABLE', 30);
                expect(product.canAllocate(order)).toBe(false);
            });
    
            it('should can allocate if available equal to required', () => {
                const order = new OrderLine('order-ref', 'SMALL-TABLE', 20);
                expect(product.canAllocate(order)).toBe(true);
            });
    
            it('should not allocate if skus do not match', () => {
                const order = new OrderLine('order-ref', 'LARGE-TABLE', 20);
                expect(product.canAllocate(order)).toBe(false);
            });
        });
    });
});