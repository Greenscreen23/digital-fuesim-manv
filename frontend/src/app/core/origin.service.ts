import { Injectable } from '@angular/core';
import type { UUID } from 'digital-fuesim-manv-shared';
import { uuid, cloneDeepMutable } from 'digital-fuesim-manv-shared';

interface Origin {
    ws: string;
    http: string;
}

@Injectable({
    providedIn: 'root',
})
export class OriginService {
    // Currently hardcoded for demonstration purposes.
    private readonly origins: { [key: UUID]: Origin } = {
        [uuid()]: { ws: 'ws://localhost:3210', http: 'http://localhost:3211' },
        [uuid()]: { ws: 'ws://localhost:3220', http: 'http://localhost:3221' },
        [uuid()]: { ws: 'ws://localhost:3230', http: 'http://localhost:3231' },
    };

    private currentOrigins: { [key: UUID]: Origin } = {};

    constructor() {
        this.resetOrigins();
        this.currentOriginId = Object.keys(this.currentOrigins)[
            Math.floor(Math.random() * Object.keys(this.currentOrigins).length)
        ]!;
    }

    private currentOriginId: UUID;

    public resetOrigins() {
        this.currentOrigins = cloneDeepMutable(this.origins);
    }

    public newOrigin(): boolean {
        if (Object.keys(this.currentOrigins).length === 1) {
            return false;
        }

        delete this.currentOrigins[this.currentOriginId];
        this.currentOriginId = Object.keys(this.currentOrigins)[
            Math.floor(Math.random() * Object.keys(this.currentOrigins).length)
        ]!;

        return true;
    }

    public get wsOrigin(): string {
        return this.currentOrigins[this.currentOriginId]!.ws;
    }

    public get httpOrigin(): string {
        return this.currentOrigins[this.currentOriginId]!.http;
    }
}
