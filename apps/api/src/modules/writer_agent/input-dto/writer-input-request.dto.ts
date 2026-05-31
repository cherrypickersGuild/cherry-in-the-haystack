import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * POST /writer-agent/input — Request body
 *
 * spec §1 Request:
 *   { "topic": "RAG", "limit": 20 }
 */
export class WriterInputRequestDto {
  static schema = z.object({
    topic: z.string().trim().min(1).max(200),
    limit: z.number().int().min(1).max(200).default(20),
  });

  @ApiProperty({
    example: 'RAG',
    description: '핸드북에서 찾을 주제 (concept canonical name 또는 extracted_concept 표면형)',
  })
  topic!: string;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: '반환할 evidence_rows 최대 개수 (1~200)',
  })
  limit?: number;
}
