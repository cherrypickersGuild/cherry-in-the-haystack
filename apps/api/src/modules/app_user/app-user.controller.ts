import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { AppUserService } from './app-user.service';
import { SignupDto } from './input-dto/signup.dto';
import { SigninDto } from './input-dto/signin.dto';
import { LoginDto } from './input-dto/login.dto';
import { RefreshTokenDto } from './input-dto/refresh-token.dto';
import type { SignupResponseDto } from './output-dto/signup-response.dto';
import type { SigninResponseDto } from './output-dto/signin-response.dto';
import type { LoginResponseDto } from './output-dto/login-response.dto';
import type { MeResponseDto } from './output-dto/me-response.dto';

type RequestWithJwtUser = Request & {
  user?: {
    id?: string;
  };
};

@Controller('app-user')
@ApiTags('AppUser')
export class AppUserController {
  constructor(private readonly appUserService: AppUserService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create app user with email' })
  @ApiBody({ type: SignupDto })
  async signup(
    @Body(new ZodValidationPipe(SignupDto.schema)) dto: SignupDto,
  ): Promise<SignupResponseDto> {
    return this.appUserService.signup(dto);
  }

  @Post('signin')
  @ApiOperation({
    summary:
      'Issue one-time sign-in token by email (development response, should be sent by email in production)',
  })
  @ApiBody({ type: SigninDto })
  async signin(
    @Body(new ZodValidationPipe(SigninDto.schema)) dto: SigninDto,
    @Req() req: Request,
  ): Promise<SigninResponseDto> {
    return this.appUserService.signin(dto, req);
  }

  @Post('login')
  @ApiOperation({ summary: 'Exchange one-time sign-in token for JWT tokens' })
  @ApiBody({ type: LoginDto })
  async login(
    @Body(new ZodValidationPipe(LoginDto.schema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    return this.appUserService.login(dto, req, res);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token by refresh token' })
  @ApiBody({ type: RefreshTokenDto })
  async refresh(
    @Body(new ZodValidationPipe(RefreshTokenDto.schema)) dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    return this.appUserService.refresh(dto, req, res);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.appUserService.logout(req, res);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current app user profile' })
  async me(@Req() req: Request): Promise<MeResponseDto> {
    const request = req as RequestWithJwtUser;
    const userId = String(request.user?.id ?? '').trim();
    if (!userId) {
      throw new UnauthorizedException('Invalid authentication context.');
    }
    return this.appUserService.me(userId);
  }
}
