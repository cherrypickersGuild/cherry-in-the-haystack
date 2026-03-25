import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from './database.module';
import { jwtConstants } from '../constants/constants';
import { RoleJwtStrategy } from '../role-jwt.strategy';

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: jwtConstants.secret,
    }),
  ],
  providers: [RoleJwtStrategy],
  exports: [PassportModule, JwtModule, RoleJwtStrategy],
})
export class AuthModule {}
