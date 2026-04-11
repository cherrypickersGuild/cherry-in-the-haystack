import { Module } from '@nestjs/common';
import { AuthModule } from 'src/common/basic-module/auth.module';
import { DatabaseModule } from 'src/common/basic-module/database.module';
import { PromptTemplateController } from './prompt-template.controller';
import { PromptTemplateService } from './prompt-template.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [PromptTemplateController],
  providers: [PromptTemplateService],
})
export class PromptTemplateModule {}
