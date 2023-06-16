import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { setupCypressTestingValues } from './shared/functions/cypress';
import type { AppState } from './state/app.state';
import { OriginService } from './core/origin.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent {
    constructor(
        private readonly store: Store<AppState>,
        private readonly originService: OriginService
    ) {
        setupCypressTestingValues({
            store: this.store,
            backendBaseUrl: this.originService.httpOrigin,
            websocketBaseUrl: this.originService.wsOrigin,
        });
    }
}
