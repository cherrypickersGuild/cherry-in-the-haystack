import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from './database.module';
import { jwtConstants } from '../constants/constants';
import { RoleJwtStrategy } from '../role-jwt.strategy';
import { RolesGuard } from 'src/middleware/roles.guard';

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: jwtConstants.secret,
    }),
  ],
  providers: [RoleJwtStrategy, RolesGuard],
  exports: [PassportModule, JwtModule, RoleJwtStrategy, RolesGuard],
})
export class AuthModule {}
