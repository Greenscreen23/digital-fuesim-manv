/* eslint-disable @typescript-eslint/no-throw-literal */
/* eslint-disable @typescript-eslint/no-namespace */
import { Type } from 'class-transformer';
import {
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { TransferPoint } from '../../models';
import { Position } from '../../models/utils';
import type { ExerciseState } from '../../state';
import type { Mutable } from '../../utils';
import { uuidValidationOptions, UUID } from '../../utils';
import type { Action, ActionReducer } from '../action-reducer';
import { ReducerError } from '../reducer-error';
import { calculateDistance } from './utils/calculate-distance';

export class AddTransferPointAction implements Action {
    @IsString()
    public readonly type = `[TransferPoint] Add TransferPoint`;
    @ValidateNested()
    @Type(() => TransferPoint)
    public readonly transferPoint!: TransferPoint;
}

export class MoveTransferPointAction implements Action {
    @IsString()
    public readonly type = '[TransferPoint] Move TransferPoint';

    @IsUUID(4, uuidValidationOptions)
    public readonly transferPointId!: UUID;

    @ValidateNested()
    @Type(() => Position)
    public readonly targetPosition!: Position;
}

export class RenameTransferPointAction implements Action {
    @IsString()
    public readonly type = '[TransferPoint] Rename TransferPoint';

    @IsUUID(4, uuidValidationOptions)
    public readonly transferPointId!: UUID;

    @IsString()
    public readonly internalName!: string;

    @IsString()
    public readonly externalName!: string;
}

export class RemoveTransferPointAction implements Action {
    @IsString()
    public readonly type = '[TransferPoint] Remove TransferPoint';

    @IsUUID(4, uuidValidationOptions)
    public readonly transferPointId!: UUID;
}

export class ConnectTransferPointsAction implements Action {
    @IsString()
    public readonly type = '[TransferPoint] Connect TransferPoints';

    @IsUUID(4, uuidValidationOptions)
    public readonly transferPointId1!: UUID;

    @IsUUID(4, uuidValidationOptions)
    public readonly transferPointId2!: UUID;

    @IsOptional()
    @IsNumber()
    public readonly duration?: number;
}

export class DisconnectTransferPointsAction implements Action {
    @IsString()
    public readonly type = '[TransferPoint] Disconnect TransferPoints';

    @IsUUID(4, uuidValidationOptions)
    public readonly transferPointId1!: UUID;

    @IsUUID(4, uuidValidationOptions)
    public readonly transferPointId2!: UUID;
}

export namespace TransferPointActionReducers {
    export const addTransferPoint: ActionReducer<AddTransferPointAction> = {
        action: AddTransferPointAction,
        reducer: (draftState, { transferPoint }) => {
            draftState.transferPoints[transferPoint.id] = transferPoint;
            return draftState;
        },
        rights: 'trainer',
    };

    export const moveTransferPoint: ActionReducer<MoveTransferPointAction> = {
        action: MoveTransferPointAction,
        reducer: (draftState, { transferPointId, targetPosition }) => {
            const transferPoint = draftState.transferPoints[transferPointId];
            if (!transferPoint) {
                throw new ReducerError(
                    `TransferPoint with id ${transferPointId} does not exist`
                );
            }
            transferPoint.position = targetPosition;
            return draftState;
        },
        rights: 'trainer',
    };

    export const renameTransferPoint: ActionReducer<RenameTransferPointAction> =
        {
            action: RenameTransferPointAction,
            reducer: (
                draftState,
                { transferPointId, internalName, externalName }
            ) => {
                const transferPoint =
                    draftState.transferPoints[transferPointId];
                if (!transferPoint) {
                    throw new ReducerError(
                        `TransferPoint with id ${transferPointId} does not exist`
                    );
                }
                transferPoint.internalName = internalName;
                transferPoint.externalName = externalName;
                return draftState;
            },
            rights: 'trainer',
        };

    export const connectTransferPoints: ActionReducer<ConnectTransferPointsAction> =
        {
            action: ConnectTransferPointsAction,
            reducer: (
                draftState,
                { transferPointId1, transferPointId2, duration }
            ) => {
                // If the transferPoints are already connected, we only update the duration
                // TODO: We currently only support bidirectional connections between different transfer points.
                if (transferPointId1 === transferPointId2) {
                    throw new ReducerError(
                        `TransferPoint with id ${transferPointId1} cannot connect to itself`
                    );
                }
                const transferPoint1 = getTransferPoint(
                    draftState,
                    transferPointId1
                );
                const transferPoint2 = getTransferPoint(
                    draftState,
                    transferPointId2
                );
                const _duration =
                    duration ??
                    estimateDuration(
                        transferPoint1.position,
                        transferPoint2.position
                    );
                transferPoint1.reachableTransferPoints[transferPointId2] = {
                    duration: _duration,
                };
                transferPoint2.reachableTransferPoints[transferPointId1] = {
                    duration: _duration,
                };
                return draftState;
            },
            rights: 'trainer',
        };

    export const disconnectTransferPoints: ActionReducer<DisconnectTransferPointsAction> =
        {
            action: DisconnectTransferPointsAction,
            reducer: (draftState, { transferPointId1, transferPointId2 }) => {
                // We remove the connection from both directions
                if (transferPointId1 === transferPointId2) {
                    throw new ReducerError(
                        `TransferPoint with id ${transferPointId1} cannot disconnect from itself`
                    );
                }
                const transferPoint1 = getTransferPoint(
                    draftState,
                    transferPointId1
                );
                const transferPoint2 = getTransferPoint(
                    draftState,
                    transferPointId2
                );
                delete transferPoint1.reachableTransferPoints[transferPointId2];
                delete transferPoint2.reachableTransferPoints[transferPointId1];
                return draftState;
            },
            rights: 'trainer',
        };

    export const removeTransferPoint: ActionReducer<RemoveTransferPointAction> =
        {
            action: RemoveTransferPointAction,
            reducer: (draftState, { transferPointId }) => {
                if (!draftState.transferPoints[transferPointId]) {
                    throw new ReducerError(
                        `TransferPoint with id ${transferPointId} does not exist`
                    );
                }
                delete draftState.transferPoints[transferPointId];
                // TODO: If we can assume that the transfer points are always connected to each other,
                // we could just iterate over draftState.transferPoints[transferPointId].reachableTransferPoints
                for (const _transferPointId of Object.keys(
                    draftState.transferPoints
                )) {
                    const transferPoint =
                        draftState.transferPoints[_transferPointId];
                    for (const connectedTransferPointId of Object.keys(
                        transferPoint.reachableTransferPoints
                    )) {
                        const connectedTransferPoint =
                            draftState.transferPoints[connectedTransferPointId];
                        delete connectedTransferPoint.reachableTransferPoints[
                            transferPointId
                        ];
                    }
                }
                // TODO: Remove the vehicles and personnel in transit
                return draftState;
            },
            rights: 'trainer',
        };
}

// Helpers

/**
 * @returns The transferPoint with the given id
 * @throws ReducerError if the transferPoint does not exist
 */
function getTransferPoint(
    state: Mutable<ExerciseState>,
    transferPointId: UUID
) {
    const transferPoint = state.transferPoints[transferPointId];
    if (!transferPoint) {
        throw new ReducerError(
            `TransferPoint with id ${transferPointId} does not exist`
        );
    }
    return transferPoint;
}

/**
 *
 * @returns an estimated duration in ms to drive between the the two given positions
 * The resulting value is a multiple of 0.1 minutes.
 */
function estimateDuration(startPosition: Position, targetPosition: Position) {
    // TODO: tweak these values more
    // How long in ms it takes to start + stop moving
    const overheadSummand = 10 * 1000;
    // In meters per second
    // On average an RTW drives 11.5 m/s (41.3 km/h https://www.leitstelle-lausitz.de/leitstelle/haeufig-gestellte-fragen/#:~:text=Wie%20viel%20schneller%20ist%20ein,30%2C4%20km%2Fh.)
    // Be aware that this could be significantly off for longer distances due to, e.g., the use of the Autobahn.
    const averageSpeed = 11.5;
    // How many times longer is the actual driving distance in contrast to the distance as the crow flies?
    // A good heuristic is 1.3 (https://forum.openstreetmap.org/viewtopic.php?id=3941)
    const distanceFactor = 1.3;
    const estimateTime =
        overheadSummand +
        ((distanceFactor * calculateDistance(startPosition, targetPosition)) /
            averageSpeed) *
            // Convert to milliseconds
            1000;
    const multipleOf = 1000 * 60 * 0.1;
    return Math.round(estimateTime / multipleOf) * multipleOf;
}
