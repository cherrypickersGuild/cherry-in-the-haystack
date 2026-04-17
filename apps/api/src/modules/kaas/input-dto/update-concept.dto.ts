import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const UpdateConceptSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(50).optional(),
  summary: z.string().min(1).optional(),
  content_md: z.string().optional(),
  quality_score: z.number().min(0).max(5).optional(),
  source_count: z.number().int().min(0).optional(),
  related_concepts: z.array(z.string()).optional(),
  is_on_sale: z.boolean().optional(),
  sale_discount: z.number().min(0).max(100).optional(),
});

export class UpdateConceptDto {
  static schema = UpdateConceptSchema;

  @ApiProperty({ required: false }) title?: string;
  @ApiProperty({ required: false }) category?: string;
  @ApiProperty({ required: false }) summary?: string;
  @ApiProperty({ required: false }) content_md?: string;
  @ApiProperty({ required: false }) quality_score?: number;
  @ApiProperty({ required: false }) source_count?: number;
  @ApiProperty({ required: false }) related_concepts?: string[];
  @ApiProperty({ required: false }) is_on_sale?: boolean;
  @ApiProperty({ required: false }) sale_discount?: number;
}
