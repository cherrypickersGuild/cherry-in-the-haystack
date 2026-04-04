import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class RefreshTokenDto {
  static schema = z.object({
    refreshToken: z.string().trim().min(1).optional(),
  });

  @ApiPropertyOptional({
    description: 'Fallback when cookie is unavailable',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken?: string;
}
