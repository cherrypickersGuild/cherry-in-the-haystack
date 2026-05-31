import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { GraphConceptService } from './graph-concept.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * GraphConceptService unit tests — axios(SPARQL) mock.
 */
describe('GraphConceptService', () => {
  let service: GraphConceptService;

  const bindings = (rows: any[]) => ({
    data: { results: { bindings: rows } },
  });

  const node = (relation: string, name: string, label: string, desc?: string) => ({
    relation: { value: relation },
    rel: { value: `http://example.org/llm-ontology#${name}` },
    label: { value: label },
    ...(desc ? { desc: { value: desc } } : {}),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GraphConceptService],
    }).compile();
    service = module.get(GraphConceptService);
    jest.clearAllMocks();
  });

  it('SELF/PARENT/CHILD 를 분류해 반환한다', async () => {
    mockedAxios.get.mockResolvedValue(
      bindings([
        node('SELF', 'RAG', 'RAG', 'RAG 설명'),
        node('PARENT', 'AugmentationTechnique', 'AugmentationTechnique', '상위 설명'),
        node('CHILD', 'DenseRetrieval', 'DenseRetrieval', '하위 설명'),
        node('CHILD', 'HybridRetrieval', 'HybridRetrieval'),
      ]),
    );

    const res = await service.getRelatedConcepts('RAG');

    expect(res.topic).toBe('RAG');
    expect(res.matched).toEqual({ id: 'RAG', label: 'RAG', description: 'RAG 설명' });
    expect(res.parents).toHaveLength(1);
    expect(res.parents[0].id).toBe('AugmentationTechnique');
    expect(res.children.map((c) => c.id)).toEqual(['DenseRetrieval', 'HybridRetrieval']);
    expect(res.children[1].description).toBeNull();
    expect(res.meta.total).toBe(3); // parents(1) + children(2)
    expect(res.errors).toHaveLength(0);
  });

  it('IRI 에서 local name 만 추출한다', async () => {
    mockedAxios.get.mockResolvedValue(bindings([node('SELF', 'RAG', 'RAG')]));
    const res = await service.getRelatedConcepts('RAG');
    expect(res.matched?.id).toBe('RAG');
  });

  it('결과 없으면 NO_CONCEPT_MATCHED', async () => {
    mockedAxios.get.mockResolvedValue(bindings([]));
    const res = await service.getRelatedConcepts('nonexistent');
    expect(res.matched).toBeNull();
    expect(res.parents).toHaveLength(0);
    expect(res.errors[0].code).toBe('NO_CONCEPT_MATCHED');
  });

  it('GraphDB 에러시 GRAPHDB_ERROR 로 graceful 처리', async () => {
    mockedAxios.get.mockRejectedValue(new Error('connection refused'));
    const res = await service.getRelatedConcepts('RAG');
    expect(res.errors[0].code).toBe('GRAPHDB_ERROR');
    expect(res.parents).toHaveLength(0);
  });

  it('SPARQL injection 방지 — 따옴표 이스케이프', async () => {
    mockedAxios.get.mockResolvedValue(bindings([]));
    await service.getRelatedConcepts('RA"G');
    const sentQuery = mockedAxios.get.mock.calls[0][1]?.params?.query as string;
    expect(sentQuery).toContain('RA\\"G');
  });
});
