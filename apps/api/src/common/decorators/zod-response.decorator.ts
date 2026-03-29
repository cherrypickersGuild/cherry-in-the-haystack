// decorators/zod-response.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { ZodTypeAny } from 'zod';

export const ZOD_RESPONSE_SCHEMA = 'ZOD_RESPONSE_SCHEMA';

export const ZodResponse = (schema: ZodTypeAny) =>
  SetMetadata(ZOD_RESPONSE_SCHEMA, schema);
