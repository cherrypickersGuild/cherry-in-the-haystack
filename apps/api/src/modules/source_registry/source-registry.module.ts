import { Module } from '@nestjs/common';
import { AuthModule } from 'src/common/basic-module/auth.module';
import { DatabaseModule } from 'src/common/basic-module/database.module';
import { SourceRegistryController } from './source-registry.controller';
import { SourceRegistryService } from './source-registry.service';

/**
 * 소스 관리 — 노션에서 옮겨 온 표.
 * 기획: apps/docs/source-registry/1-work-guidelines.md
 */
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SourceRegistryController],
  providers: [SourceRegistryService],
})
export class SourceRegistryModule {}
