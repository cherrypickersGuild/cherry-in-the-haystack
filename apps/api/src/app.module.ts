import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppUserModule } from './modules/app_user/app-user.module';


@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AppUserModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
