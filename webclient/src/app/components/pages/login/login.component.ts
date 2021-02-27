import { Component, OnInit } from '@angular/core';
import { Validators } from '@angular/forms';
import {LoginData, LoginService} from '../../../services/login-service/login.service';
import {FormControl, FormGroup} from '@angular/forms';

@Component({
  selector: 'ch-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  loginForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required]),
  });

  constructor(
    private loginService: LoginService
  ) {}

  ngOnInit(): void {
  }

  onSubmit() {
    const loginData: LoginData = {
      name: this.loginForm.get('name').value,
      password: this.loginForm.get('password').value,
    };
    this.loginService.login(loginData);
  }
}
