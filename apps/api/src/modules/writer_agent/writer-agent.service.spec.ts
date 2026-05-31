import { Test, TestingModule } from '@nestjs/testing';
import { WriterAgentService } from './writer-agent.service';
import { EvidenceRow } from './entity/evidence-row.entity';

/**
 * WriterAgentService unit tests
 *
 * knex.raw 를 mock 하여 buildWriterInput 의 응답 형식(명세 §3)과
 * SQL 이 handbook v2 스키마(concept/concept_alias)를 치는지 검증.
 */
describe('WriterAgentService', () => {
  let service: WriterAgentService;
  let rawMock: jest.Mock;
  let lastSql: string;
  let lastBindings: Record<string, unknown>;

  const sampleRow: EvidenceRow = {
    chunk_id: '0192b4c0-0000-7000-8000-000000000001',
    body_text: 'RAG combines retrieval with generation to ground answers in evidence.',
    page_number: 173,
    paragraph_index: 2,
    chapter_paragraph_index: 5,
    chapter_id: '0192b4c0-0000-7000-8000-0000000000c1',
    section_id: null,
    book_id: '0192b4c0-0000-7000-8000-0000000000b1',
    book_title: 'AI Engineering',
    book_author: 'Chip Huyen',
    concept_id: '0192b4c0-0000-7000-8000-0000000000a1',
    concept_name: 'Retrieval-Augmented Generation',
    is_primary: true,
    extraction_confidence: 0.92,
    extract_type: 'METRIC',
    handbook_topic: 'Retrieval Systems',
    handbook_subtopic: 'RAG',
    judge_originality: 0.78,
    judge_depth: 0.85,
    judge_technical_accuracy: 0.95,
    importance_score: 0.9,
    sampling_weight: 1.0,
  };

  const buildService = async (rows: EvidenceRow[]) => {
    rawMock = jest.fn((sql: string, bindings: Record<string, unknown>) => {
      lastSql = sql;
      lastBindings = bindings;
      return Promise.resolve({ rows });
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WriterAgentService,
        { provide: 'KNEX_CONNECTION', useValue: { raw: rawMock } },
      ],
    }).compile();
    service = module.get<WriterAgentService>(WriterAgentService);
  };

  describe('buildWriterInput — 정상 (evidence 있음)', () => {
    beforeEach(async () => {
      await buildService([sampleRow]);
    });

    it('명세 §3 래퍼 형식을 반환한다', async () => {
      const res = await service.buildWriterInput('RAG evaluation', 20);
      expect(res).toMatchObject({
        version: '0.2',
        topic: 'RAG evaluation',
        graph_context: { mode: 'direct_graphdb', focus_concepts: [], related_concepts: [] },
        update_payload: null,
        meta: { source: 'backend', schema_version: 'handbook-v2' },
        errors: [],
      });
      expect(typeof res.meta.generated_at).toBe('string');
    });

    it('evidence_rows 를 그대로 전달한다', async () => {
      const res = await service.buildWriterInput('RAG evaluation', 20);
      expect(res.evidence_rows).toHaveLength(1);
      expect(res.evidence_rows[0]).toEqual(sampleRow);
      expect(res.errors).toHaveLength(0);
    });

    it('SQL 이 handbook v2 스키마(concept/concept_alias)를 친다', async () => {
      await service.buildWriterInput('RAG evaluation', 20);
      expect(lastSql).toContain('handbook.concept');
      expect(lastSql).toContain('handbook.concept_alias');
      expect(lastSql).toContain('handbook.paragraph_concept_link');
      // 구버전 잔재가 없어야 함
      expect(lastSql).not.toContain('idea_group');
      expect(lastSql).not.toContain('evidence_metadata');
    });

    it('NUMERIC 컬럼을 float8 로 캐스팅한다', async () => {
      await service.buildWriterInput('RAG evaluation', 20);
      expect(lastSql).toContain('::float8');
    });

    it('topic / limit 바인딩을 넘긴다', async () => {
      await service.buildWriterInput('RAG evaluation', 13);
      expect(lastBindings).toEqual({ topic: 'RAG evaluation', limit: 13 });
    });
  });

  describe('buildWriterInput — 빈 결과', () => {
    beforeEach(async () => {
      await buildService([]);
    });

    it('evidence 없으면 errors 에 NO_DATA 를 넣는다', async () => {
      const res = await service.buildWriterInput('nonexistent-topic', 20);
      expect(res.evidence_rows).toHaveLength(0);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0].code).toBe('NO_DATA');
    });
  });
});
