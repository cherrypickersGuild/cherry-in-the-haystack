import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Knex } from 'knex';

import { jwtConstants } from './constants/constants';
import type { AppUserEntity } from 'src/modules/app_user/entity/app-user.entity';

@Injectable()
export class RoleJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: { id?: string; email?: string; role?: string }) {
    const userId = String(payload.id ?? '').trim();
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }

    const user = await this.knex('core.app_user')
      .where({ id: userId })
      .where('is_active', true)
      .whereNull('revoked_at')
      .first<
        Pick<
          AppUserEntity,
          'id' | 'email' | 'name' | 'role' | 'subscription_tier'
        >
      >(['id', 'email', 'name', 'role', 'subscription_tier']);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.role) {
      throw new UnauthorizedException('Role not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscription_tier: user.subscription_tier,
    };
  }
}
