import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class SigninDto {
  static schema = z.object({
    email: z.string().email(),
  });

  @ApiProperty({ example: 'alice@company.com' })
  email!: string;
}
