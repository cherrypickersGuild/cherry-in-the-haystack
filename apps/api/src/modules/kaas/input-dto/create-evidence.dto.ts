import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const CreateEvidenceSchema = z.object({
  source: z.string().min(1).max(500),
  summary: z.string().min(1),
  curator: z.string().min(1).max(100),
  curator_tier: z.enum(['Bronze', 'Silver', 'Gold', 'Platinum']).default('Bronze'),
  comment: z.string().optional().default(''),
});

export class CreateEvidenceDto {
  static schema = CreateEvidenceSchema;

  @ApiProperty({ example: 'Chip Huyen — AI Engineering' })
  source: string;

  @ApiProperty({ example: 'RAG 입문 자료, chunking 전략 필독' })
  summary: string;

  @ApiProperty({ example: 'Hyejin Kim' })
  curator: string;

  @ApiProperty({ example: 'Gold', required: false })
  curator_tier?: string;

  @ApiProperty({ required: false })
  comment?: string;
}
