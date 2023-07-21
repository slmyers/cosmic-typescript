import { Container } from 'inversify';
import { IBatch } from '../../../packages/domain/Batch';
import { container as parentContainer, chance } from '../../jest.setup';
import { BatchRepo, IBatchRepo } from '../../../packages/repository/BatchRepo';

describe('fakeRepository', () => {
    let container: Container;

    beforeEach(() => {
        container = new Container();
        container.parent = parentContainer;
    });


    describe('save', () => {
        let repository: IBatchRepo;
        let batch: IBatch;

        beforeEach(() => {
            container.bind<IBatch[]>('fakeBatches').toConstantValue([]);
            repository = container.get(BatchRepo);
        });

        it('should save a batch', async () => {
            batch = chance.batch();
            const ref = await repository.add(batch);
            expect(ref).toBeDefined();
            expect(ref).toEqual(batch.reference);
        });
    });

    describe('get', () => {
        let repository: IBatchRepo;
        let batch: IBatch;

        beforeEach(() => {
            batch = chance.batch();
            container.bind<IBatch[]>('fakeBatches').toConstantValue([batch]);
            repository = container.get(BatchRepo);
        });

        it('should get a batch', async () => {
            const result = await repository.get(batch.reference);
            expect(result).toBeDefined();
            expect(result).toEqual(batch);
        });
    });
});