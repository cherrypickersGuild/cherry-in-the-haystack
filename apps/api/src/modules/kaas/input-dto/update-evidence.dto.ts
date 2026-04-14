import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const UpdateEvidenceSchema = z.object({
  source: z.string().min(1).max(500).optional(),
  summary: z.string().min(1).optional(),
  curator: z.string().min(1).max(100).optional(),
  curator_tier: z.enum(['Bronze', 'Silver', 'Gold', 'Platinum']).optional(),
  comment: z.string().optional(),
});

export class UpdateEvidenceDto {
  static schema = UpdateEvidenceSchema;

  @ApiProperty({ required: false }) source?: string;
  @ApiProperty({ required: false }) summary?: string;
  @ApiProperty({ required: false }) curator?: string;
  @ApiProperty({ required: false }) curator_tier?: string;
  @ApiProperty({ required: false }) comment?: string;
}
