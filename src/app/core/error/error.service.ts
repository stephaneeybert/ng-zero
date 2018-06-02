import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { Location, LocationStrategy, PathLocationStrategy } from '@angular/common';
import { HttpErrorResponse, HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, Event, NavigationError } from '@angular/router';

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/of';

import * as StackTraceParser from 'error-stack-parser';

@Injectable()
export class ErrorService {

    constructor(
        private injector: Injector,
        private router: Router,
        private httpClient: HttpClient,
    ) {
        // Subscribe to the navigation errors
        this.router
            .events
            .subscribe((event: Event) => {
                if (event instanceof NavigationError) {
                    this.log(event.error)
                        .subscribe((errorWithContext) => {
                            this.router.navigate(['/error'], { queryParams: errorWithContext });
                        });
                }
            });
    }

    public log(error) {
        const errorToSend = this.addContextInfo(error);
        return MockHttpService.post(errorToSend);
    }

    private addContextInfo(error) {
        const name = error.name || null;
        const appId = 'My API id';
        const user = 'The logged in user if any';
        const time = new Date().getTime();
        const id = `${appId}-${user}-${time}`;
        const location = this.injector.get(LocationStrategy);
        const url = location instanceof PathLocationStrategy ? location.path() : '';
        const status = error.status || null;
        const message = error.message || error.toString();
        const stack = error instanceof HttpErrorResponse ? null : error; // StackTraceParser.parse(error); TODO
        const method = stack ? stack[0].functionName : null;

        const errorWithContext = { message, method, name, appId, user, time, id, url, status, stack };
        console.log(errorWithContext);
        return errorWithContext;
    }

    fireFakeClientError() {
        throw new Error('Another runtime error)');
        // As the 'it' object is not defined, this should produce a runtime error
        // return it.happens;
    }

    fireFakeServerError() {
        this.httpClient
            .get('https://jsonplaceholder.typicode.com/1')
            .subscribe();
    }
}

class MockHttpService {
    static post(error): Observable<any> {
        console.log('The error has been sent to the server for future correction');
        return Observable.of(error);
    }
}
