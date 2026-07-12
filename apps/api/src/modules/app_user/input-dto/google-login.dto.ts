import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class GoogleLoginDto {
  static schema = z.object({
    idToken: z.string().trim().min(1),
  });

  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...',
    description: 'Google Identity Services ID token (credential)',
  })
  idToken!: string;
}
