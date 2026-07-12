import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class BenchKeyDto {
  static schema = z.object({
    // 형식만 검증 (실제 유효성은 bench 실행 시 확인). Anthropic 키 접두사 + 최소 길이.
    apiKey: z
      .string()
      .trim()
      .min(20)
      .refine((v) => v.startsWith('sk-ant-'), {
        message: 'Anthropic API key must start with "sk-ant-".',
      }),
  });

  @ApiProperty({ example: 'sk-ant-api03-...' })
  apiKey!: string;
}
