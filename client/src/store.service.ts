import {
    ExerciseAction,
    ExerciseState,
    Immutable,
    ReducerError,
    reduceExerciseState,
} from 'digital-fuesim-manv-shared';
import { OriginService } from './origin.service';
import fs from 'node:fs';

export class Store {
    public _state?: Immutable<ExerciseState>;
    public _ownClientId?: string;
    public _exerciseId?: string;
    public _lastClientName?: string;

    constructor(private readonly originService: OriginService) {}

    public applyServerAction(serverAction: ExerciseAction) {
        try {
            this.state = reduceExerciseState(this.state, serverAction);
        } catch (error: any) {
            if (error instanceof ReducerError) {
                console.warn(
                    process.env['ID'],
                    ': Error applying action:',
                    error,
                    ' while connected to ',
                    this.originService.wsOrigin
                );
                // If the reducer throws an error (which is expected due to optimistic updates), we don't change the state
                return;
            }
            throw error;
        }
    }

    public get state(): Immutable<ExerciseState> {
        if (!this._state) {
            throw new Error('State not initialized');
        }
        return this._state;
    }

    public set state(newState: Immutable<ExerciseState> | undefined) {
        this._state = newState;
    }

    public get ownClientId(): string {
        if (!this._ownClientId) {
            throw new Error('ownClientId not initialized');
        }
        return this._ownClientId;
    }

    public set ownClientId(newOwnClientId: string | undefined) {
        this._ownClientId = newOwnClientId;
    }

    public get exerciseId(): string {
        if (!this._exerciseId) {
            console.error('exerciseId not initialized');
            return process.env['EXERCISE_ID']!;
        }
        return this._exerciseId;
    }

    public set exerciseId(newExerciseId: string | undefined) {
        this._exerciseId = newExerciseId;
    }

    public get lastClientName(): string {
        if (!this._lastClientName) {
            throw new Error('lastClientName not initialized');
        }
        return this._lastClientName;
    }

    public set lastClientName(newLastClientName: string | undefined) {
        this._lastClientName = newLastClientName;
    }

    public joinExercise(
        ownClientId: string,
        exerciseId: string,
        clientName: string,
        exerciseState: ExerciseState
    ) {
        this.ownClientId = ownClientId;
        this.exerciseId = exerciseId;
        this.lastClientName = clientName;
        this.state = exerciseState;
    }
}
