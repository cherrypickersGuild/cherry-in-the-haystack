import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class SignupDto {
  static schema = z.object({
    email: z.string().email(),
    name: z.string().trim().min(1).max(200).optional(),
    timezone: z.string().trim().min(1).max(50).optional(),
  });

  @ApiProperty({ example: 'alice@company.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'Alice' })
  name?: string;

  @ApiPropertyOptional({ example: 'Asia/Seoul' })
  timezone?: string;
}
