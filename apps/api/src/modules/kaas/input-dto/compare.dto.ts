import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const CompareSchema = z.object({
  known_topics: z.array(
    z.object({
      topic: z.string(),
      lastUpdated: z.string(),
    }),
  ),
});

export class CompareDto {
  static schema = CompareSchema;

  @ApiProperty({
    example: [
      { topic: 'RAG', lastUpdated: '2025-11-15' },
      { topic: 'Embeddings', lastUpdated: '2026-04-12' },
    ],
  })
  known_topics: { topic: string; lastUpdated: string }[];
}
