// interceptors/zod-response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ZodTypeAny } from 'zod';
import { ZOD_RESPONSE_SCHEMA } from 'src/common/decorators/zod-response.decorator';

@Injectable()
export class ZodResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const schema: ZodTypeAny | undefined = this.reflector.get(
      ZOD_RESPONSE_SCHEMA,
      context.getHandler(),
    );

    if (!schema) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        const result = schema.safeParse(data);
        if (!result.success) {
          const message = result.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
          throw new InternalServerErrorException('출력 검증 실패: ' + message);
        }
        return data;
      }),
    );
  }
}
