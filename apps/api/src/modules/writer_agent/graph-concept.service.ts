import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

import { GRAPHDB } from '../../config';
import {
  ConceptNode,
  RelatedConceptsErrorItem,
  RelatedConceptsResponseDto,
} from './input-dto/related-concepts-response.dto';

interface SparqlBinding {
  [key: string]: { value: string };
}

@Injectable()
export class GraphConceptService {
  private readonly logger = new Logger(GraphConceptService.name);
  private readonly endpoint = `${GRAPHDB.url}/repositories/${GRAPHDB.repository}`;

  /* ═══════════════════════════════════════════
     GET /writer-agent/related-concepts
     GraphDB(llm-ontology) 에서 topic 의 상위/하위 관련 개념 조회.
  ═══════════════════════════════════════════ */
  async getRelatedConcepts(topic: string): Promise<RelatedConceptsResponseDto> {
    const errors: RelatedConceptsErrorItem[] = [];
    let bindings: SparqlBinding[] = [];

    try {
      bindings = await this.runSparql(this.buildQuery(topic));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`[getRelatedConcepts] GraphDB query failed: ${msg}`);
      errors.push({ code: 'GRAPHDB_ERROR', message: msg });
      return this.empty(topic, errors);
    }

    const parents: ConceptNode[] = [];
    const children: ConceptNode[] = [];
    let matched: ConceptNode | null = null;

    for (const b of bindings) {
      const node: ConceptNode = {
        id: this.localName(b.rel?.value),
        label: b.label?.value ?? '',
        description: b.desc?.value ?? null,
      };
      const rel = b.relation?.value;
      if (rel === 'PARENT') parents.push(node);
      else if (rel === 'CHILD') children.push(node);
      else if (rel === 'SELF') matched = node;
    }

    if (!matched && parents.length === 0 && children.length === 0) {
      errors.push({
        code: 'NO_CONCEPT_MATCHED',
        message: `topic="${topic}" 에 매칭되는 개념이 GraphDB 에 없습니다.`,
      });
      this.logger.warn(`[getRelatedConcepts] no concept for topic="${topic}"`);
    }

    return {
      topic,
      matched,
      parents,
      children,
      meta: {
        source: 'graphdb',
        repository: GRAPHDB.repository,
        total: parents.length + children.length,
      },
      errors,
    };
  }

  /* SELF(매칭개념) + PARENT(상위) + CHILD(하위) 한 번에. Resource/Thing/self 제외. */
  private buildQuery(topic: string): string {
    const t = this.escapeLiteral(topic);
    return `
PREFIX llm: <http://example.org/llm-ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT DISTINCT ?relation ?rel ?label ?desc WHERE {
  ?node a owl:Class ; rdfs:label ?tl .
  FILTER(lcase(str(?tl)) = lcase("${t}"))
  {
    BIND(?node AS ?rel) BIND("SELF" AS ?relation)
  } UNION {
    ?node rdfs:subClassOf ?rel . BIND("PARENT" AS ?relation)
  } UNION {
    ?rel rdfs:subClassOf ?node . BIND("CHILD" AS ?relation)
  }
  ?rel rdfs:label ?label .
  OPTIONAL { ?rel llm:description ?desc }
  FILTER(isIRI(?rel) && ?rel != owl:Thing && ?rel != rdfs:Resource)
  FILTER(?relation = "SELF" || ?rel != ?node)
} ORDER BY ?relation ?label`;
  }

  private async runSparql(query: string): Promise<SparqlBinding[]> {
    const res = await axios.get(this.endpoint, {
      params: { query },
      headers: { Accept: 'application/sparql-results+json' },
      timeout: 8000,
    });
    return res.data?.results?.bindings ?? [];
  }

  private localName(iri?: string): string {
    if (!iri) return '';
    const i = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
    return i >= 0 ? iri.slice(i + 1) : iri;
  }

  private escapeLiteral(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private empty(
    topic: string,
    errors: RelatedConceptsErrorItem[],
  ): RelatedConceptsResponseDto {
    return {
      topic,
      matched: null,
      parents: [],
      children: [],
      meta: { source: 'graphdb', repository: GRAPHDB.repository, total: 0 },
      errors,
    };
  }
}
