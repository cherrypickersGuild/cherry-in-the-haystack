import { ApiProperty } from '@nestjs/swagger';

export class SigninResponseDto {
  @ApiProperty({
    description: 'One-time token for login. In production this should be sent by email.',
  })
  signInToken!: string;

  @ApiProperty({ description: 'ISO timestamp' })
  expiresAt!: string;
}
