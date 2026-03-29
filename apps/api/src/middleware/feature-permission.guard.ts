import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { FEATURES_KEY } from 'src/common/decorators/features.decorator';
import { FeaturePermissionService } from '../common/basic-service/feature-permission.service';

@Injectable()
export class FeaturePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featurePermissionService: FeaturePermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures = this.reflector.getAllAndOverride<string[]>(
      FEATURES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // @Features 지정이 없으면 기능권한 검증은 스킵(기존 RolesGuard만 적용됨)
    if (!requiredFeatures || requiredFeatures.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    // 기능권한은 로그인 기반이므로 user 없으면 차단
    if (!user || !user.role) return false;

    // requiredFeatures 중 하나라도 허용이면 통과(OR 정책)
    // 만약 "모두 필요(AND 정책)"가 맞다면 every로 바꾸면 됨.
    for (const featureCode of requiredFeatures) {
      const ok = await this.featurePermissionService.isAllowed(
        String(user.role),
        featureCode,
      );
      if (ok) return true;
    }

    return false;
  }
}
