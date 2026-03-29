import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { FEATURES_KEY } from 'src/common/decorators/features.decorator';

@Injectable()
export class FeatureResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const requiredFeatures =
      this.reflector.getAllAndOverride<string[]>(FEATURES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredFeatures.length === 0) {
      return next.handle();
    }

    return next
      .handle()
      .pipe(map((data) => this.attachRequiredFeatures(data, requiredFeatures)));
  }

  private attachRequiredFeatures(data: unknown, requiredFeatures: string[]) {
    if (Array.isArray(data)) {
      return data.map((item) => {
        if (!item || typeof item !== 'object') return item;
        return { ...item, required_features: requiredFeatures };
      });
    }

    if (!data || typeof data !== 'object') {
      return data;
    }

    return {
      ...data,
      required_features: requiredFeatures,
    };
  }
}
