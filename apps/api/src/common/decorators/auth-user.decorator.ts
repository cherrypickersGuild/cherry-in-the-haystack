// src/common/decorators/auth-user.decorator.ts
import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

export const AuthUser = createParamDecorator(
  (data: string | undefined, context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) {
      throw new InternalServerErrorException(
        'AuthUser 데코레이터는 JWT Guard와 함께 사용해야 합니다. Request에 user 프로퍼티가 존재하지 않습니다!',
      );
    }
    return data ? user[data] : user;
  },
);
