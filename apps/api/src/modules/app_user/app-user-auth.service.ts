import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Knex } from 'knex';
import type { Request, Response } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';

import { jwtConstants } from 'src/common/constants/constants';
import { TOKEN_EXPIRY_USER } from 'src/common/constants/auth.constants';
import { RedisService } from 'src/common/basic-service/redis.service';
import sendEmail, { EMAIL_TEMPLATE } from 'src/utils/resend';
import type { AppUserEntity, AppUserRole } from './entity/app-user.entity';
import type { SignupDto } from './input-dto/signup.dto';
import type { SigninDto } from './input-dto/signin.dto';
import type { LoginDto } from './input-dto/login.dto';
import type { RefreshTokenDto } from './input-dto/refresh-token.dto';
import type { SignupResponseDto } from './output-dto/signup-response.dto';
import type { SigninResponseDto } from './output-dto/signin-response.dto';
import type { LoginResponseDto, LoginUserDto } from './output-dto/login-response.dto';
import type { MeResponseDto } from './output-dto/me-response.dto';

type JwtPayload = {
  id: string;
  email: string;
  role: AppUserRole;
  tokenType: 'access' | 'refresh';
};

type RequestWithAuthData = Request & {
  cookies?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

const MAGIC_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_COOKIE_NAME = 'cherryRefreshToken';
const REFRESH_COOKIE_PATH = '/api/app-user';

@Injectable()
export class AppUserAuthService {
  private readonly logger = new Logger(AppUserAuthService.name);

  constructor(
    @Inject('KNEX_CONNECTION')
    private readonly knex: Knex,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async signup(dto: SignupDto): Promise<SignupResponseDto> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const existing = await this.knex('core.app_user')
      .whereRaw('lower(email) = ?', [normalizedEmail])
      .whereNull('revoked_at')
      .first('id');

    if (existing) {
      throw new ConflictException('Email is already in use.');
    }

    const id = uuidv7();
    const now = new Date();

    await this.knex('core.app_user').insert({
      id,
      email: normalizedEmail,
      name: dto.name?.trim() || null,
      subscription_tier: 'FREE',
      role: 'GENERAL',
      timezone: dto.timezone?.trim() || 'Asia/Seoul',
      is_active: true,
      created_at: now,
      updated_at: now,
      revoked_at: null,
    });

    return {
      id,
      email: normalizedEmail,
      role: 'GENERAL',
      subscriptionTier: 'FREE',
    };
  }

  async signin(dto: SigninDto, req: Request): Promise<SigninResponseDto> {
    let user = await this.getActiveUserByEmail(dto.email);
    if (!user) {
      await this.signup({ email: dto.email });
      user = await this.getActiveUserByEmail(dto.email);
      if (!user) {
        throw new UnauthorizedException('Failed to create user.');
      }
    }

    const signInToken = randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(signInToken);
    const expiresAt = new Date(Date.now() + MAGIC_TOKEN_TTL_MS);
    const now = new Date();

    await this.knex('core.app_user').where({ id: user.id }).update({
      magic_token_hash: tokenHash,
      magic_token_expires_at: expiresAt,
      magic_token_consumed_at: null,
      magic_token_last_ip: this.extractClientIp(req),
      magic_token_last_user_agent: this.extractUserAgent(req),
      updated_at: now,
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const loginLink = `${frontendUrl}/login?email=${encodeURIComponent(user.email)}&token=${signInToken}`;

    await sendEmail(
      user.email,
      '로그인 링크',
      EMAIL_TEMPLATE(
        '로그인 링크',
        '아래 버튼을 클릭하면 Cherry in the Haystack에 로그인됩니다.<br/>링크는 15분간 유효합니다.',
        '로그인하기',
        loginLink,
      ),
    );

    return {
      expiresAt: expiresAt.toISOString(),
    };
  }

  async login(
    dto: LoginDto,
    req: Request,
    res: Response,
  ): Promise<LoginResponseDto> {
    const user = await this.getActiveUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid login token.');
    }

    const storedHash = this.toByteaBuffer(user.magic_token_hash);
    const inputHash = this.hashToken(dto.signInToken);
    const expiresAt = this.toDate(user.magic_token_expires_at);
    const consumedAt = this.toDate(user.magic_token_consumed_at);

    if (!storedHash || !expiresAt) {
      throw new UnauthorizedException('Login token is missing.');
    }

    if (consumedAt) {
      throw new UnauthorizedException('Login token is already used.');
    }

    if (expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Login token is expired.');
    }

    if (
      storedHash.length !== inputHash.length ||
      !timingSafeEqual(storedHash, inputHash)
    ) {
      throw new UnauthorizedException('Invalid login token.');
    }

    const now = new Date();
    await this.knex('core.app_user').where({ id: user.id }).update({
      last_login_at: now,
      magic_token_hash: null,
      magic_token_expires_at: null,
      magic_token_consumed_at: now,
      magic_token_last_ip: this.extractClientIp(req),
      magic_token_last_user_agent: this.extractUserAgent(req),
      updated_at: now,
    });

    const tokens = await this.issueTokens(user);
    this.setRefreshCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      user: this.toLoginUserDto(user),
    };
  }

  async refresh(
    dto: RefreshTokenDto,
    req: Request,
    res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = this.extractRefreshToken(req, dto);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing.');
    }

    const payload = this.verifyToken(refreshToken);
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid token type.');
    }

    const storedToken = await this.redisService.getString(
      this.refreshTokenKey(payload.id),
    );
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const user = await this.getActiveUserById(payload.id);
    if (!user) {
      throw new UnauthorizedException('User not found or inactive.');
    }

    const tokens = await this.issueTokens(user);
    this.setRefreshCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
    };
  }

  async logout(req: Request, res: Response): Promise<void> {
    const refreshToken = this.extractRefreshToken(req);

    if (refreshToken) {
      try {
        const payload = this.verifyToken(refreshToken);
        if (payload.tokenType === 'refresh') {
          await this.redisService.delete(this.refreshTokenKey(payload.id));
        }
      } catch (error) {
        this.logger.debug(
          `Ignoring logout token parsing failure: ${(error as Error)?.message ?? 'unknown'}`,
        );
      }
    }

    this.clearRefreshCookie(res);
  }

  async me(userId: string): Promise<MeResponseDto> {
    const user = await this.getActiveUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found or inactive.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionTier: user.subscription_tier,
      lastLoginAt: this.toDate(user.last_login_at)?.toISOString() ?? null,
    };
  }

  private async issueTokens(user: AppUserEntity): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessPayload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenType: 'access',
    };

    const refreshPayload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenType: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: jwtConstants.secret,
      expiresIn: TOKEN_EXPIRY_USER.ACCESS,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: jwtConstants.secret,
      expiresIn: TOKEN_EXPIRY_USER.REFRESH,
    });

    await this.redisService.set(
      this.refreshTokenKey(user.id),
      refreshToken,
      TOKEN_EXPIRY_USER.REFRESH_TOKEN_TTL,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  private verifyToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token, {
        secret: jwtConstants.secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid token.');
    }
  }

  private refreshTokenKey(userId: string): string {
    return `cherry:auth:refresh:${userId}`;
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: TOKEN_EXPIRY_USER.REFRESH_COOKIE,
      path: REFRESH_COOKIE_PATH,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
    });
  }

  private hashToken(rawToken: string): Buffer {
    return createHash('sha256').update(rawToken).digest();
  }

  private toByteaBuffer(value: unknown): Buffer | null {
    if (Buffer.isBuffer(value)) return value;
    if (typeof value !== 'string') return null;

    const normalized = value.startsWith('\\x') ? value.slice(2) : value;
    if (!/^[0-9a-fA-F]+$/.test(normalized)) return null;

    return Buffer.from(normalized, 'hex');
  }

  private normalizeEmail(email: string): string {
    return String(email ?? '').trim().toLowerCase();
  }

  private extractClientIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return String(forwarded[0]).trim();
    }
    return req.ip ? String(req.ip).trim() : null;
  }

  private extractUserAgent(req: Request): string | null {
    const userAgent = req.headers['user-agent'];
    if (!userAgent) return null;
    return Array.isArray(userAgent)
      ? String(userAgent[0] ?? '').trim() || null
      : String(userAgent).trim() || null;
  }

  private extractRefreshToken(
    req: Request,
    dto?: RefreshTokenDto,
  ): string | null {
    const request = req as RequestWithAuthData;

    const cookieToken = request.cookies?.[REFRESH_COOKIE_NAME];
    if (typeof cookieToken === 'string' && cookieToken.trim()) {
      return cookieToken.trim();
    }

    const bodyToken =
      typeof request.body?.refreshToken === 'string'
        ? request.body.refreshToken.trim()
        : null;
    if (bodyToken) return bodyToken;

    if (dto?.refreshToken?.trim()) {
      return dto.refreshToken.trim();
    }

    return null;
  }

  private toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const asDate = new Date(String(value));
    return Number.isNaN(asDate.getTime()) ? null : asDate;
  }

  private toLoginUserDto(user: AppUserEntity): LoginUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionTier: user.subscription_tier,
    };
  }

  private async getActiveUserByEmail(email: string): Promise<AppUserEntity | null> {
    const row = await this.knex('core.app_user')
      .whereRaw('lower(email) = ?', [this.normalizeEmail(email)])
      .where('is_active', true)
      .whereNull('revoked_at')
      .first<AppUserEntity>();

    return row ?? null;
  }

  private async getActiveUserById(userId: string): Promise<AppUserEntity | null> {
    const row = await this.knex('core.app_user')
      .where({ id: userId })
      .where('is_active', true)
      .whereNull('revoked_at')
      .first<AppUserEntity>();

    return row ?? null;
  }
}
