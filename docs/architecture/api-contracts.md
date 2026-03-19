# API Contracts

### Internal Python Interfaces

```python
class GraphDBClient:
    def load_concept(self, concept_name: str) -> Concept | None
    def find_similar_concepts(self, name: str, threshold: float = 0.90) -> list[Concept]
    def create_concept(self, concept: Concept) -> str
    def add_relation(self, from_id: str, to_id: str, relation_type: str, props: dict) -> None
    def get_relations(self, concept_id: str) -> dict[str, list[RelatedConcept]]

class VectorDB:
    def store_embedding(self, paragraph_id: int, embedding: list[float], metadata: dict) -> None
    def search_similar(self, query_embedding: list[float], top_k: int = 10,
                       handbook_topic: str | None = None) -> list[SearchResult]
    def batch_store(self, records: list[dict]) -> None
```

### TypeScript Pipeline Interfaces

```typescript
// packages/pipeline/src/integrations/notion-client.ts
interface NotionClient {
  createPage(databaseId: string, properties: Record<string, unknown>): Promise<string>
  updatePage(pageId: string, properties: Record<string, unknown>): Promise<void>
  queryDatabase(
    databaseId: string,
    filter: Record<string, unknown>,
    cursor?: string
  ): Promise<{ pages: NotionPage[]; nextCursor: string | null }>
}

// packages/pipeline/src/publication/github-committer.ts
interface GitHubCommitter {
  commitFiles(files: { path: string; content: string }[], message: string): Promise<string> // returns SHA
}
```

### Writer Agent Query Result (Python)

```python
@dataclass
class ConceptQueryResult:
    concept: Concept
    prerequisites: list[RelatedConcept]
    related: list[RelatedConcept]
    subtopics: list[RelatedConcept]
    extends: list[RelatedConcept]
    contradicts: list[RelatedConcept]
    evidence: list[EvidenceParagraph]  # ordered by importance_score DESC
```

### Cron Job Exit Contracts

Each job in `packages/pipeline/src/jobs/` logs a summary on completion:

```typescript
// Standard job result logged to pipeline_runs table
interface JobResult {
  jobName: string
  status: 'success' | 'partial' | 'failed'
  itemsProcessed: number
  errors: number
  durationMs: number
}
```

---
