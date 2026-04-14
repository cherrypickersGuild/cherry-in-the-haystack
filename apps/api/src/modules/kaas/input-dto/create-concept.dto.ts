import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const CreateConceptSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  summary: z.string().min(1),
  content_md: z.string().optional(),
  quality_score: z.number().min(0).max(5).optional(),
  source_count: z.number().int().min(0).optional(),
  related_concepts: z.array(z.string()).optional(),
});

export class CreateConceptDto {
  static schema = CreateConceptSchema;

  @ApiProperty({ example: 'rag' })
  id: string;

  @ApiProperty({ example: 'Retrieval-Augmented Generation' })
  title: string;

  @ApiProperty({ example: 'Retrieval & Search' })
  category: string;

  @ApiProperty({ example: 'RAG는 LLM 응답 정확도를 높이는 기법' })
  summary: string;

  @ApiProperty({ required: false })
  content_md?: string;

  @ApiProperty({ example: 4.5, required: false })
  quality_score?: number;

  @ApiProperty({ example: 3, required: false })
  source_count?: number;

  @ApiProperty({ example: ['chain-of-thought', 'embeddings'], required: false })
  related_concepts?: string[];
}
