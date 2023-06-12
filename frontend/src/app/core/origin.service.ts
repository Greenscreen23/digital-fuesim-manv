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
        [uuid()]: { ws: 'ws://localhost:3201', http: 'http://localhost:3301' },
        [uuid()]: { ws: 'ws://localhost:3202', http: 'http://localhost:3302' },
        [uuid()]: { ws: 'ws://localhost:3203', http: 'http://localhost:3303' },
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
