import { ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class UpdateTemplateDto {
  static schema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(500).optional(),
    tone_text: z.string().trim().min(1).optional(),
  });

  @ApiPropertyOptional({ example: '수정된 템플릿 이름' })
  name?: string;

  @ApiPropertyOptional({ example: '수정된 설명' })
  description?: string;

  @ApiPropertyOptional({ example: '객관적이고 기술 중심의 톤' })
  tone_text?: string;
}
