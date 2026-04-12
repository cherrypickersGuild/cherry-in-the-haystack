import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class InsertArticleDto {
  static schema = z.object({
    title: z.string().trim().min(1).max(500),
    url: z.string().url().max(1000),
    content_raw: z.string().trim().min(1),
    published_at: z.string().datetime(),
    source_name: z.string().trim().min(1).max(200),
    source_type: z.enum(['RSS', 'TWITTER', 'LINKEDIN', 'YOUTUBE', 'REDDIT', 'KAKAO', 'WEBSITE', 'CUSTOM']).default('RSS'),
    language: z.string().max(10).optional(),
    author: z.string().max(255).optional(),
  });

  @ApiProperty({ example: 'LangChain v0.3 Adds Multi-Modal RAG Pipeline with Vision Support' })
  title!: string;

  @ApiProperty({ example: 'https://blog.langchain.dev/langchain-v03-multi-modal-rag' })
  url!: string;

  @ApiProperty({ example: 'LangChain v0.3 introduces a multi-modal RAG pipeline that supports image and text retrieval in a unified chain. The new VisionRetriever component enables seamless integration of CLIP-based image embeddings alongside traditional text embeddings, allowing developers to build applications that can answer questions about both visual and textual content. Benchmarks show 35% improvement in multi-modal QA tasks compared to text-only RAG pipelines. The update also includes a simplified chain composition API and native streaming support for all retrievers.' })
  content_raw!: string;

  @ApiProperty({ example: '2026-04-12T14:00:00Z' })
  published_at!: string;

  @ApiProperty({ example: 'LangChain Blog', description: '소스 이름 (없으면 자동 생성)' })
  source_name!: string;

  @ApiPropertyOptional({
    example: 'RSS',
    enum: ['RSS', 'TWITTER', 'LINKEDIN', 'YOUTUBE', 'REDDIT', 'KAKAO', 'WEBSITE', 'CUSTOM'],
    default: 'RSS',
  })
  source_type?: string;

  @ApiPropertyOptional({ example: 'en' })
  language?: string;

  @ApiPropertyOptional({ example: 'Harrison Chase' })
  author?: string;
}
