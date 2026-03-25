import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';

@Injectable()
export class FeaturePermissionService {
  constructor(@Inject('KNEX_CONNECTION') private readonly knex: Knex) {}

  /**
   * 역할(roleCode)이 특정 기능(featureCode)을 사용할 수 있는지 확인
   */
  async isAllowed(roleCode: string, featureCode: string): Promise<boolean> {
    const row = await this.knex('role_feature_permission as rfp')
      .join('role as r', 'r.id', 'rfp.role_id')
      .join('feature as f', 'f.id', 'rfp.feature_id')
      .where('r.code', roleCode)
      .andWhere('f.code', featureCode)
      .andWhere('rfp.enabled', 1)
      .andWhere('f.is_active', 1)
      .whereNull('r.revoked_at')
      .whereNull('f.revoked_at')
      .whereNull('rfp.revoked_at')
      .first('rfp.id');

    return !!row;
  }
}
