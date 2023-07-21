import { Container } from 'inversify';
import { BatchService } from '../../../packages/service/Batch.service';
import { IBatch, IOrderLine } from '../../../packages/domain/Batch';
import { container as parentContainer, chance } from '../../jest.setup';
import { BatchRepo } from '../../../packages/repository/BatchRepo';

// TODO: change name so tab is easier to recognize in vscode
describe('BatchService', () => {
    let container: Container;
    let service: BatchService;
    let repo: BatchRepo;

    beforeEach(() => {
        container = parentContainer.createChild();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('get', () => {
        let batch: IBatch;
        let spy: jest.SpyInstance;
        beforeEach(() => {
            batch = chance.batch();
            container.bind<IBatch[]>('fakeBatches').toConstantValue([batch]);
            repo = container.get<BatchRepo>(BatchRepo);
            spy = jest.spyOn(repo, 'get');
            container.bind<BatchRepo>(BatchRepo).toConstantValue(repo);
            service = container.get<BatchService>(BatchService);
        });

        it('should get a batch', async () => {
            const result: IBatch = await service.get(batch.reference);
            expect(result).toEqual(batch);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(batch.reference);
        });

        it('should throw an error if batch not found', async () => {
            spy.mockImplementation(async () => {
                throw new Error('Batch not found');
            });
            await expect(service.get(batch.reference)).rejects.toThrow('Batch not found');
        });
    });
    describe('add', () => {
        let batch: IBatch;
        let spy: jest.SpyInstance;
        beforeEach(() => {
            batch = chance.batch();
            repo = container.get<BatchRepo>(BatchRepo);
            spy = jest.spyOn(repo, 'add');
            container.bind<BatchRepo>(BatchRepo).toConstantValue(repo);
            service = container.get<BatchService>(BatchService);
        });
        it('should add a batch', async () => {
            const result: string = await service.add(batch);
            expect(result).toEqual(batch.reference);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(batch);
        });
    });
    
    describe('allocate', () => {
        let batch: IBatch;
        let spy: jest.SpyInstance;
        let orderLine: IOrderLine;
        let testSku: string;

        beforeEach(() => {
            testSku = chance.string();
            batch = chance.batch({ sku: testSku, available_quantity: 10 });
            container.bind<IBatch[]>('fakeBatches').toConstantValue([batch]);
            orderLine = chance.orderLine({ sku: testSku, qty: 5 });
            repo = container.get<BatchRepo>(BatchRepo);
            spy = jest.spyOn(repo, 'allocate');
            container.bind<BatchRepo>(BatchRepo).toConstantValue(repo);
            service = container.get<BatchService>(BatchService);
        });

        it('should allocate a batch', async () => {
            const result: string = await service.allocate(orderLine);
            expect(result).toEqual(batch.reference);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(batch.reference, orderLine);
        });
    });
});