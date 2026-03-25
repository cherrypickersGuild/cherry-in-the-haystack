// src/modules/auth/strategies/role-jwt.strategy.ts
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Knex } from 'knex';

import { jwtConstants } from './constants/constants';
import type { RoleModel, UserModel } from 'src/common/basic_entities';

@Injectable()
export class RoleJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtConstants.secret,
    });
  }

  /**
   * payload.role을 믿지 않고, DB의 user.role_id -> role.code를 조회해서
   * request.user.role에 role.code를 넣는다.
   * payload에는 최소 id만 있어도 됨.
   */
  async validate(payload: { id: string; email?: string; role?: string }) {
    const userIdBin = this.uuidToBin(payload.id);
    if (!userIdBin) {
      throw new UnauthorizedException('User not found');
    }

    const user = await this.knex('user as u')
      .join('role as r', 'r.id', 'u.role_id')
      .where('u.id', userIdBin)
      .whereNull('u.revoked_at')
      .whereNull('r.revoked_at')
      .first<
        Pick<UserModel, 'email' | 'name'> & {
          id: Buffer | string;
          role_id: Buffer | string;
          role_code: RoleModel['code'];
        }
      >([
        'u.id',
        'u.email',
        'u.name',
        'u.role_id',
        this.knex.raw('r.code as role_code'),
      ]);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.role_code) {
      throw new UnauthorizedException('Role not found');
    }

    const normalizedId = this.binToUuid(user.id);
    const normalizedRoleId = this.binToUuid(user.role_id);
    if (!normalizedId || !normalizedRoleId) {
      throw new UnauthorizedException('User not found');
    }

    return {
      ...user,
      id: normalizedId,
      role_id: normalizedRoleId,
      role: user.role_code, // ★ 이 값이 FeaturePermissionService의 r.code와 매칭됨
    };
  }

  private uuidToBin(id: string): Buffer | null {
    const s = String(id ?? '')
      .trim()
      .toLowerCase();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        s,
      )
    ) {
      return null;
    }
    return Buffer.from(s.replace(/-/g, ''), 'hex');
  }

  private binToUuid(v: Buffer | string | null | undefined): string | null {
    if (!v) return null;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          s,
        )
      ) {
        return s;
      }
      if (/^[0-9a-f]{32}$/.test(s)) {
        return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
      }
      return null;
    }
    if (!Buffer.isBuffer(v) || v.length !== 16) return null;
    const hex = v.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
}
