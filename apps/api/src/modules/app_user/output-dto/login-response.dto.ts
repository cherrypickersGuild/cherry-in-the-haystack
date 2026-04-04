import { ApiProperty } from '@nestjs/swagger';
import type { AppUserRole, AppUserTier } from '../entity/app-user.entity';

export class LoginUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  name!: string | null;

  @ApiProperty({ enum: ['ADMIN', 'MANAGER', 'GENERAL'] })
  role!: AppUserRole;

  @ApiProperty({ enum: ['FREE', 'PAID', 'ENTERPRISE'] })
  subscriptionTier!: AppUserTier;
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: () => LoginUserDto })
  user!: LoginUserDto;
}
