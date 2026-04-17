import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const PurchaseSchema = z.object({
  concept_id: z.string().min(1),
  api_key: z.string().optional(),
  budget: z.number().min(1).optional(),
  chain: z.enum(['status', 'near', 'mock']).optional(),
  pre_signed_tx: z.string().optional(),
});

export class PurchaseDto {
  static schema = PurchaseSchema;

  @ApiProperty({ example: 'rag' })
  concept_id: string;

  @ApiProperty({ required: false, description: '에이전트 API Key (생략 시 첫 번째 에이전트 사용)' })
  api_key?: string;

  @ApiProperty({ example: 20, required: false })
  budget?: number;

  @ApiProperty({ example: 'status', enum: ['status', 'near', 'mock'], required: false, description: '온체인 기록 대상 체인 (생략 시 서버 기본값)' })
  chain?: 'status' | 'near' | 'mock';

  @ApiProperty({ required: false, description: '유저 지갑이 이미 서명한 tx hash (NEAR 등). 제공되면 서버가 온체인 서명을 생략하고 DB에만 기록.' })
  pre_signed_tx?: string;
}
