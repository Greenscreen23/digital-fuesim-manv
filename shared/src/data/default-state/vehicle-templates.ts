import { VehicleTemplate } from '../../models';
import type { ImageProperties } from '../../models/utils/image-properties';

const rtwImage: ImageProperties = {
    url: '/assets/rtw_vehicle.png',
    height: 100,
    aspectRatio: 3693 / 1670,
};

const ktwImage: ImageProperties = {
    url: '/assets/ktw_vehicle.png',
    height: 100,
    aspectRatio: 5046 / 2465,
};

const gwSanImage: ImageProperties = {
    url: '/assets/gwsan_vehicle.png',
    height: 120,
    aspectRatio: 5000 / 2474,
};

const nefImage: ImageProperties = {
    url: '/assets/nef_vehicle.png',
    height: 70,
    aspectRatio: 4455 / 1847,
};

const hubschrauberImage: ImageProperties = {
    url: '/assets/hubschrauber_vehicle.svg',
    height: 300,
    aspectRatio: 310 / 130,
};

const rtwVehicleTemplate = VehicleTemplate.create(
    'RTW',
    rtwImage,
    2,
    ['notSan', 'rettSan'],
    [{
        logicalOperator: 'or',
        green: 2,
        yellow: 1,
        red: 1,
    }]
);

const ktwVehicleTemplate = VehicleTemplate.create(
    'KTW',
    ktwImage,
    2,
    ['san', 'rettSan'],
    [{
        logicalOperator: 'or',
        green: 2,
        yellow: 1,
        red: 1,
    }]
);

const gwSanVehicleTemplate = VehicleTemplate.create(
    'GW-San',
    gwSanImage,
    0,
    ['gf', 'rettSan', 'rettSan', 'san', 'san', 'notarzt'],
    [{
        logicalOperator: 'and',
        green: 2,
        yellow: 1,
        red: 1,
    },
    {
        logicalOperator: 'and',
        green: 2,
        yellow: 1,
        red: 1,
    },
    {
        logicalOperator: 'and',
        green: 2,
        yellow: 1,
        red: 1,
    },
    {
        logicalOperator: 'and',
        green: 2,
        yellow: 1,
        red: 1,
    },
    {
        logicalOperator: 'and',
        green: 2,
        yellow: 1,
        red: 1,
    },
    {
        logicalOperator: 'and',
        green: 2,
        yellow: 1,
        red: 1,
    },
    {
        logicalOperator: 'and',
        green: 2,
        yellow: 1,
        red: 1,
    },
    {
        logicalOperator: 'and',
        green: 2,
        yellow: 1,
        red: 1,
    }],
);

const nefVehicleTemplate = VehicleTemplate.create(
    'NEF',
    nefImage,
    0,
    ['notarzt', 'notSan'],
    [{
        logicalOperator: 'or',
        green: 2,
        yellow: 2,
        red: 2,
    }]
);

const hubschrauberVehicleTemplate = VehicleTemplate.create(
    'Hubschrauber',
    hubschrauberImage,
    1,
    ['notarzt', 'notSan'],
    [{
        logicalOperator: 'or',
        green: 2,
        yellow: 1,
        red: 1,
    }]
);

export const defaultVehicleTemplates: readonly VehicleTemplate[] = [
    rtwVehicleTemplate,
    ktwVehicleTemplate,
    gwSanVehicleTemplate,
    nefVehicleTemplate,
    hubschrauberVehicleTemplate,
];
