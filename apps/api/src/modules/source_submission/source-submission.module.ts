import { Module } from '@nestjs/common';
import { AuthModule } from 'src/common/basic-module/auth.module';
import { DatabaseModule } from 'src/common/basic-module/database.module';
import { LocalDiskStorage, SUBMISSION_STORAGE } from './submission-storage.service';
import { AdminSubmissionController } from './admin-submission.controller';
import { SourceSubmissionController } from './source-submission.controller';
import { SourceSubmissionService } from './source-submission.service';
import { UploadGateService } from './upload-gate.service';
import { AnalysisRunner } from './analysis/analysis.runner';
import { LoadPreviewService } from './load-preview.service';

/**
 * 유저 자료·소스 투고.
 * 기획: apps/docs/source-submission/1-work-guidelines.md
 */
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SourceSubmissionController, AdminSubmissionController],
  providers: [
    SourceSubmissionService,
    UploadGateService,
    AnalysisRunner,
    LoadPreviewService,
    LocalDiskStorage,
    // 저장소를 바꿀 때 고치는 곳은 여기 한 줄뿐이다 (S3Storage 등)
    { provide: SUBMISSION_STORAGE, useExisting: LocalDiskStorage },
  ],
  exports: [SUBMISSION_STORAGE],
})
export class SourceSubmissionModule {}
