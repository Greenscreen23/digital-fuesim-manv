export interface Origin {
    ws: string;
    http: string;
}

export class OriginService {
    private allOrigins: Origin[] = [];
    private currentOriginId: number = 0;

    constructor(wsOrigin: string, httpOrigin: string) {
        this.allOrigins = [{
            ws: wsOrigin,
            http: httpOrigin,
        }];
        this.currentOriginId = 0;
    }

    public newOrigin(): boolean {
        this.currentOriginId++;
        if (this.currentOriginId === this.allOrigins.length) {
            return false;
        }

        return true;
    }

    public set origins(origins: Origin[]) {
        this.allOrigins = origins;
        this.currentOriginId = 0;
    }

    public get wsOrigin(): string {
        return this.allOrigins[this.currentOriginId]!.ws;
    }

    public get httpOrigin(): string {
        return this.allOrigins[this.currentOriginId]!.http;
    }
}
