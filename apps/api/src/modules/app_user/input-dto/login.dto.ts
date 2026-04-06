import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class LoginDto {
  static schema = z.object({
    email: z.string().email(),
    signInToken: z.string().trim().min(1),
  });

  @ApiProperty({ example: 'tomatojams@naver.com' })
  email!: string;

  @ApiProperty({ example: '1c68f4e8f7f2f1c07a2ee0b2d1f24e08fba4f69f35b2a5bb' })
  signInToken!: string;
}
