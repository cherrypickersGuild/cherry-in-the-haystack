import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/** 유저가 넣은 주소가 javascript: 로 시작하는 것을 막는다 (기획 §6-F). */
const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => /^https?:\/\//i.test(v), { message: 'https:// 또는 http:// 로 시작해야 합니다.' });

export class SubmitUrlDto {
  static schema = z.object({
    url: httpUrl,
    name: z.string().trim().min(1).max(200),   // DB: name varchar(200)
    reason: z.string().trim().max(1000).optional(),
  });

  @ApiProperty({ example: 'https://www.anthropic.com/engineering', description: '자료 주소' })
  url!: string;

  @ApiProperty({ example: 'Anthropic Engineering Blog', description: '유저가 붙인 제목' })
  name!: string;

  @ApiPropertyOptional({ example: '에이전트 운영 사례가 올라옵니다.', description: '왜 볼 만한가' })
  reason?: string;
}

export class CheckDuplicateDto {
  static schema = z.object({ url: httpUrl });

  @ApiProperty({ example: 'https://huyenchip.com', description: '중복인지 확인할 주소' })
  url!: string;
}
