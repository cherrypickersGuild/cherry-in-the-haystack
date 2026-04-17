import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const RegisterAgentSchema = z.object({
  name: z.string().min(1).max(100),
  wallet_address: z.string().optional(),
  wallet_type: z.enum(['evm', 'near']).default('evm'),
  llm_provider: z.enum(['claude', 'gpt', 'custom']).default('claude'),
  llm_model: z.string().optional(),
  llm_api_key: z.string().optional(),
  domain_interests: z.array(z.string()).default([]),
});

export class RegisterAgentDto {
  static schema = RegisterAgentSchema;

  @ApiProperty({ example: 'Coding Assistant' })
  name: string;

  @ApiProperty({ example: '0x742d...F4a8', required: false })
  wallet_address?: string;

  @ApiProperty({ example: 'evm', enum: ['evm', 'near'], required: false })
  wallet_type?: 'evm' | 'near';

  @ApiProperty({ example: 'claude', enum: ['claude', 'gpt', 'custom'], required: false })
  llm_provider?: string;

  @ApiProperty({ example: 'gpt-4o-mini', required: false })
  llm_model?: string;

  @ApiProperty({ example: 'sk-ant-...', required: false, description: 'LLM API Key (Anthropic/OpenAI)' })
  llm_api_key?: string;

  @ApiProperty({ example: ['AI Engineering', 'LLM Frameworks'] })
  domain_interests: string[];
}
