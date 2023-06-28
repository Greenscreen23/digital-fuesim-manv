import { Injectable } from '@angular/core';
import type { UUID } from 'digital-fuesim-manv-shared';
import { uuid, cloneDeepMutable } from 'digital-fuesim-manv-shared';

export interface Origin {
    ws: string;
    http: string;
}

@Injectable({
    providedIn: 'root',
})
export class OriginService {
    private allOrigins: { [key: UUID]: Origin } = {};
    private currentOrigins: { [key: UUID]: Origin } = {};

    constructor() {
        const id = window.location.port.slice(2);
        this.allOrigins[uuid()] = {
            ws: `ws://${window.location.hostname}:32${id}`,
            http: `http://${window.location.hostname}:33${id}`,
        };
        this.resetOrigins();
        this.currentOriginId = Object.keys(this.currentOrigins)[0]!;
    }

    private currentOriginId: UUID;

    public resetOrigins() {
        this.currentOrigins = cloneDeepMutable(this.allOrigins);
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

    public set origins(origins: Origin[]) {
        this.allOrigins = {};
        origins.forEach((origin) => {
            this.allOrigins[uuid()] = origin;
        });
        this.resetOrigins();
        this.currentOriginId = Object.keys(this.currentOrigins)[
            Math.floor(Math.random() * origins.length)
        ]!;
    }

    public get wsOrigin(): string {
        return this.currentOrigins[this.currentOriginId]!.ws;
    }

    public get httpOrigin(): string {
        return this.currentOrigins[this.currentOriginId]!.http;
    }
}
