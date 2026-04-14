import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const PurchaseSchema = z.object({
  concept_id: z.string().min(1),
  api_key: z.string().optional(),
  budget: z.number().min(1).optional(),
});

export class PurchaseDto {
  static schema = PurchaseSchema;

  @ApiProperty({ example: 'rag' })
  concept_id: string;

  @ApiProperty({ required: false, description: '에이전트 API Key (생략 시 첫 번째 에이전트 사용)' })
  api_key?: string;

  @ApiProperty({ example: 20, required: false })
  budget?: number;
}
