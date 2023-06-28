import { HttpResponse } from '../utils';

export interface Origin {
    ws: string;
    http: string;
}

export function getOrigins(
    origins: Origin[]
): HttpResponse<{ origins: Origin[] }> {
    return {
        statusCode: 200,
        body: {
            origins,
        },
    };
}
