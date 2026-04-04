import { ApiProperty } from '@nestjs/swagger';
import type { AppUserRole, AppUserTier } from '../entity/app-user.entity';

export class SignupResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ['ADMIN', 'MANAGER', 'GENERAL'] })
  role!: AppUserRole;

  @ApiProperty({ enum: ['FREE', 'PAID', 'ENTERPRISE'] })
  subscriptionTier!: AppUserTier;
}
