import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/common/basic-module/database.module';

import { ConceptController } from './concept.controller';
import { ConceptService } from './concept.service';
import { CONCEPT_RELATION_PROVIDER } from './concept-relation.provider';
import { PostgresRelationProvider } from './providers/postgres-relation.provider';

/**
 * 관계 소스 전환: CONCEPT_RELATION_SOURCE = postgres(기본) | graphdb | synced
 * 기획: apps/docs/ontology-migration/2-implementation-guide.md §5
 * 지금은 postgres 구현만 등록. graphdb 구현 추가 시 여기 factory 만 바꾸면 된다.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ConceptController],
  providers: [
    ConceptService,
    PostgresRelationProvider,
    {
      provide: CONCEPT_RELATION_PROVIDER,
      useExisting: PostgresRelationProvider,
    },
  ],
  exports: [ConceptService],
})
export class ConceptModule {}
