import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema<unknown>) {}

  transform(value: unknown): unknown {
    // body, query, param 모두 처리하도록 수정
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          path: Array.isArray(err.path) ? err.path.join('.') : err.path,
          message: err.message,
        }));
        throw new BadRequestException({ message: 'Validation failed', errors });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
