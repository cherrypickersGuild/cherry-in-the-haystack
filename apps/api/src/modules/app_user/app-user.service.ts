import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppUserAuthService } from './app-user-auth.service';
import type { SignupDto } from './input-dto/signup.dto';
import type { SigninDto } from './input-dto/signin.dto';
import type { LoginDto } from './input-dto/login.dto';
import type { GoogleLoginDto } from './input-dto/google-login.dto';
import type { RefreshTokenDto } from './input-dto/refresh-token.dto';
import type { SignupResponseDto } from './output-dto/signup-response.dto';
import type { SigninResponseDto } from './output-dto/signin-response.dto';
import type { LoginResponseDto } from './output-dto/login-response.dto';
import type { MeResponseDto } from './output-dto/me-response.dto';

@Injectable()
export class AppUserService {
  constructor(private readonly appUserAuthService: AppUserAuthService) {}

  async signup(dto: SignupDto): Promise<SignupResponseDto> {
    return this.appUserAuthService.signup(dto);
  }

  async signin(dto: SigninDto, req: Request): Promise<SigninResponseDto> {
    return this.appUserAuthService.signin(dto, req);
  }

  async login(
    dto: LoginDto,
    req: Request,
    res: Response,
  ): Promise<LoginResponseDto> {
    return this.appUserAuthService.login(dto, req, res);
  }

  async googleLogin(
    dto: GoogleLoginDto,
    req: Request,
    res: Response,
  ): Promise<LoginResponseDto> {
    return this.appUserAuthService.googleLogin(dto, req, res);
  }

  async setBenchKey(userId: string, apiKey: string) {
    return this.appUserAuthService.setBenchKey(userId, apiKey);
  }

  async getBenchKeyStatus(userId: string) {
    return this.appUserAuthService.getBenchKeyStatus(userId);
  }

  async deleteBenchKey(userId: string): Promise<void> {
    return this.appUserAuthService.deleteBenchKey(userId);
  }

  /** bench 모듈이 사용 — 복호화된 회원 키 (없으면 null) */
  async getDecryptedBenchKey(userId: string): Promise<string | null> {
    return this.appUserAuthService.getDecryptedBenchKey(userId);
  }

  async refresh(
    dto: RefreshTokenDto,
    req: Request,
    res: Response,
  ): Promise<{ accessToken: string }> {
    return this.appUserAuthService.refresh(dto, req, res);
  }

  async logout(req: Request, res: Response): Promise<void> {
    return this.appUserAuthService.logout(req, res);
  }

  async me(userId: string): Promise<MeResponseDto> {
    return this.appUserAuthService.me(userId);
  }
}
