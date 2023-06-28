import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { IsValue } from '../utils/validators';
import { defaultTileMapProperties } from '../data/default-state/tile-map-properties';
import { getCreate, TileMapProperties } from './utils';

export class ExerciseConfiguration {
    @IsValue('exerciseConfiguration' as const)
    public readonly type = 'exerciseConfiguration';

    @IsBoolean()
    public readonly pretriageEnabled: boolean = true;
    @IsBoolean()
    public readonly bluePatientsEnabled: boolean = false;

    @IsString()
    public readonly patientIdentifierPrefix: string = '';

    @ValidateNested()
    @Type(() => TileMapProperties)
    public readonly tileMapProperties: TileMapProperties =
        defaultTileMapProperties;

    @IsInt()
    @Min(0)
    public readonly numberOfVehicles: number = 0;

    @IsInt()
    @Min(0)
    public readonly numberOfPatients: number = 0;

    @IsInt()
    @Min(0)
    public readonly testDuration: number = 0;


    /**
     * @deprecated Use {@link create} instead
     */
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor, @typescript-eslint/no-empty-function
    constructor() {}

    static readonly create = getCreate(this);
}
