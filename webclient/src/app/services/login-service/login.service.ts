import { Injectable } from '@angular/core';
import {ApiClient} from '../../utils/api-client';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  private api: ApiClient;

  constructor() {
    this.api = new ApiClient(environment.endpoint.login);
  }

  login(loginData: LoginData) {
    console.log(loginData);
  }
}

export interface LoginData {
  name: string;
  password: string;
}
