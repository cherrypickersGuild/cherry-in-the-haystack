import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const FollowSchema = z.object({
  concept_id: z.string().min(1),
  api_key: z.string().optional(),
  chain: z.enum(['status', 'near', 'mock']).optional(),
  pre_signed_tx: z.string().optional(),
});

export class FollowDto {
  static schema = FollowSchema;

  @ApiProperty({ example: 'rag' })
  concept_id: string;

  @ApiProperty({ required: false, description: '에이전트 API Key (생략 시 첫 번째 에이전트 사용)' })
  api_key?: string;

  @ApiProperty({ example: 'status', enum: ['status', 'near', 'mock'], required: false })
  chain?: 'status' | 'near' | 'mock';

  @ApiProperty({ required: false, description: '유저 지갑이 이미 서명한 tx hash (NEAR 등)' })
  pre_signed_tx?: string;
}
