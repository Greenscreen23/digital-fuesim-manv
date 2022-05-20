import { jest } from '@jest/globals';
import { createTestEnvironment, sleep } from '../../test/utils';
import { clientMap } from './client-map';
import { ExerciseWrapper } from './exercise-wrapper';

describe('Exercise Wrapper', () => {
    const environment = createTestEnvironment();
    it('fails getting a role for the wrong id', async () => {
        const exercise = await ExerciseWrapper.create(
            '123456',
            '12345678',
            environment.serviceProvider
        );

        expect(() => exercise.getRoleFromUsedId('wrong id')).toThrow(
            RangeError
        );
    });

    it('does nothing adding a client that is not set up', async () => {
        const exercise = await ExerciseWrapper.create(
            '123456',
            '12345678',
            environment.serviceProvider
        );
        // Use a websocket in order to have a ClientWrapper set up
        await environment.withWebsocket(async () => {
            // Sleep a bit to allow the socket to connect.
            await sleep(100);
            const client = clientMap.values().next().value;

            const applySpy = jest.spyOn(
                ExerciseWrapper.prototype,
                'applyAction'
            );
            await exercise.addClient(client);

            expect(applySpy).not.toHaveBeenCalled();
        });
    });

    it('does nothing removing a client that is not joined', async () => {
        const exercise = await ExerciseWrapper.create(
            '123456',
            '12345678',
            environment.serviceProvider
        );
        // Use a websocket in order to have a ClientWrapper set up
        await environment.withWebsocket(async () => {
            const client = clientMap.values().next().value;

            const applySpy = jest.spyOn(
                ExerciseWrapper.prototype,
                'applyAction'
            );
            applySpy.mockClear();
            await exercise.removeClient(client);

            expect(applySpy).not.toHaveBeenCalled();
        });
    });

    describe('Started Exercise', () => {
        let exercise: ExerciseWrapper | undefined;
        beforeEach(async () => {
            exercise = await ExerciseWrapper.create(
                '123456',
                '12345678',
                environment.serviceProvider
            );
            exercise.start();
        });
        afterEach(() => {
            exercise?.pause();
            exercise = undefined;
        });
        it('emits tick event in tick (repeated)', async () => {
            const applySpy = jest.spyOn(
                ExerciseWrapper.prototype,
                'applyAction'
            );
            const tickInterval = (exercise as any).tickInterval;

            applySpy.mockClear();
            await sleep(tickInterval * 2.01);
            expect(applySpy).toHaveBeenCalledTimes(2);
            let action = applySpy.mock.calls[0][0];
            expect(action.type).toBe('[Exercise] Tick');
            action = applySpy.mock.calls[1][0];
            expect(action.type).toBe('[Exercise] Tick');
        });
    });

    describe('Reactions to Actions', () => {
        it('calls start when matching action is sent', async () => {
            const exercise = await ExerciseWrapper.create(
                '123456',
                '12345678',
                environment.serviceProvider
            );

            const startMock = jest.spyOn(ExerciseWrapper.prototype, 'start');
            startMock.mockImplementation(() => ({}));

            await exercise.applyAction(
                { type: '[Exercise] Start', timestamp: 0 },
                { emitterId: (exercise as any).emitterUUID }
            );
            expect(startMock).toHaveBeenCalledTimes(1);
        });

        it('calls start when matching action is sent', async () => {
            const exercise = await ExerciseWrapper.create(
                '123456',
                '12345678',
                environment.serviceProvider
            );

            const pause = jest.spyOn(ExerciseWrapper.prototype, 'pause');
            pause.mockImplementation(() => ({}));

            await exercise.applyAction(
                { type: '[Exercise] Pause', timestamp: 0 },
                { emitterId: (exercise as any).emitterUUID }
            );
            expect(pause).toHaveBeenCalledTimes(1);
        });
    });
});
