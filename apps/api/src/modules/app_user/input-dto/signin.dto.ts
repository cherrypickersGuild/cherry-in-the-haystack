import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class SigninDto {
  static schema = z.object({
    email: z.string().email(),
    from: z.enum(['main', 'start']).optional(),
  });

  @ApiProperty({ example: 'tomatojams@naver.com' })
  email!: string;

  @ApiProperty({ example: 'main', enum: ['main', 'start'], required: false })
  from?: 'main' | 'start';
}
