import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class IngestDto {
  static schema = z.object({
    articleRawId: z.string().uuid(),
  });

  @ApiProperty({ example: '0195f300-a001-7000-8000-000000000001' })
  articleRawId!: string;
}

export class IngestForUserDto {
  static schema = z.object({
    articleRawId: z.string().uuid(),
    userId: z.string().uuid(),
  });

  @ApiProperty({ example: '0195f300-a001-7000-8000-000000000001' })
  articleRawId!: string;

  @ApiProperty({ description: 'target user UUID' })
  userId!: string;
}
