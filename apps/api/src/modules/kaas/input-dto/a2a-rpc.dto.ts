import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const A2aRpcSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.any().optional(),
});

export class A2aRpcDto {
  static schema = A2aRpcSchema;

  @ApiProperty({ example: '2.0' })
  jsonrpc: '2.0';

  @ApiProperty({ example: 1, required: false })
  id?: string | number | null;

  @ApiProperty({ example: 'tasks/send' })
  method: string;

  @ApiProperty({
    example: {
      executorAgentId: 'uuid-of-target-agent',
      message: {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      },
      taskType: 'message',
    },
    required: false,
  })
  params?: any;
}
