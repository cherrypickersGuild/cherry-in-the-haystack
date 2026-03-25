import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    // 요청 정보 추출
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url } = request;

    // 요청 시점 로깅
    this.logger.log(`Incoming Request: [${method}] ${url}`);

    // 요청 처리 시작 시각 기록
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const delay = Date.now() - now;
          const statusCode = response?.statusCode ?? 0;
          this.logger.log(
            `Outgoing Response: [${method}] ${url} ${statusCode} (${delay}ms)`,
          );
        },
        error: (err: unknown) => {
          const delay = Date.now() - now;
          const statusCode =
            response?.statusCode ??
            (err as { status?: number; statusCode?: number } | null)
              ?.status ??
            (err as { status?: number; statusCode?: number } | null)
              ?.statusCode ??
            0;
          const message =
            err instanceof Error
              ? err.message
              : typeof err === 'string'
                ? err
                : 'Unknown error';
          this.logger.error(
            `Outgoing Response Error: [${method}] ${url} ${statusCode} (${delay}ms) - ${message}`,
            err instanceof Error ? err.stack : undefined,
          );
        },
      }),
    );
  }
}
