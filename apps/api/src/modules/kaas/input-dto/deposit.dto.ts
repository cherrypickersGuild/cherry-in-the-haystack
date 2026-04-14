import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const DepositSchema = z.object({
  amount: z.number().min(1),
  api_key: z.string().optional(),
  chain: z.string().optional(),
});

export class DepositDto {
  static schema = DepositSchema;

  @ApiProperty({ example: 500, description: '충전할 크레딧 수량' })
  amount: number;

  @ApiProperty({ required: false, description: '에이전트 API Key (생략 시 첫 번째 에이전트 사용)' })
  api_key?: string;

  @ApiProperty({ required: false, description: '체인 (status, bnb, near)' })
  chain?: string;
}
