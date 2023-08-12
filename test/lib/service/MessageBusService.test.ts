import { Container } from 'inversify';
import { MessageBusService, IMessageBus } from '../../../lib/service/MessageBusService';
import { parentContainer, chance } from '../../jest.setup';

describe('MessageBusService', () => {
    let container: Container;
    let service: MessageBusService;
    let messageBus: IMessageBus;

    beforeEach(() => {
        container = parentContainer.createChild();
        messageBus = container.get('MessageBusService');
        service = container.get('MessageBusService');
    });

    describe('publish', () => {
        it('should publish', async () => {
            const event = chance.productEvent();
            await service.publish(event);

            expect(messageBus.publish).toHaveBeenCalledTimes(1);
            expect(messageBus.publish).toHaveBeenCalledWith(event);
        });
    });
});