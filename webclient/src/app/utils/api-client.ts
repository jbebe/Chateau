import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Injector} from '@angular/core';

enum HttpVerb {
  Get = 'get',
  Post = 'post',
  Put = 'put',
  Delete = 'delete'
}

export class ApiClient {

  private http: HttpClient;

  constructor(private endpoint: string) {

    const injector = Injector.create({
      providers: [{provide: HttpClient, deps: []}]
    });
    this.http = injector.get(HttpClient);
  }

  private getNormalizedPath(path: Array<any> | string): string {
    if (typeof(path) !== typeof('')) {
      // @ts-ignore: Callback signature mismatch
      path = (path as Array<any>).map(String.prototype.constructor).join('/');
    }
    return `${this.endpoint}/${path}`;
  }

  private verb<T>(verb: HttpVerb, path: Array<any> | string, model?: object, options: object = {}): Promise<T> {
    const normalizedPath = this.getNormalizedPath(path);
    if (model) {
      if (verb === HttpVerb.Delete) {
        const deleteOptions = {
          headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
          body: model
        };
        options = { ...options, ...deleteOptions };
        return this.http
          .request(HttpVerb.Delete, normalizedPath, options)
          .toPromise() as Promise<T>;
      } else {
        // @ts-ignore: Parameter count issue
        return this.http[verb](normalizedPath, model, options).toPromise() as Promise<T>;
      }
    } else {
      // @ts-ignore: Parameter count issue
      return this.http[verb](normalizedPath, options).toPromise() as Promise<T>;
    }
  }

  get<T>(path: Array<any> | string, options?: object): Promise<T> {
    return this.verb<T>(HttpVerb.Get, path, undefined, options);
  }

  create<T>(path: Array<any> | string, model: object, options?: object): Promise<T> {
    return this.verb<T>(HttpVerb.Post, path, model, options);
  }

  delete(path: Array<any> | string, model?: object, options?: object): Promise<any> {
    return this.verb<any>(HttpVerb.Delete, path, model, options);
  }

  update<T>(path: Array<any> | string, model: object, options?: object): Promise<T> {
    return this.verb<T>(HttpVerb.Put, path, model, options);
  }
}
