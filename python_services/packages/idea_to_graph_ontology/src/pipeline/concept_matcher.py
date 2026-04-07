"""Concept matcher using LLM for final matching - Improved version."""

from typing import Dict, List, Any, Optional

from pydantic import BaseModel, Field

from storage.vector_store import VectorStore
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
import os


class ExtractedConcept(BaseModel):
    """추출된 개념 모델."""
    
    concept: str = Field(..., description="추출된 개념 이름")
    context: str = Field(..., description="해당 개념이 언급된 문맥")
    mentioned_in_keyword: bool = Field(..., description="원본 키워드에 실제로 언급되었는지 여부 (True: 키워드에 언급됨, False: chunk_text에만 있음)")


class ConceptExtractionResult(BaseModel):
    """개념 추출 결과 모델."""
    
    concepts: List[ExtractedConcept] = Field(
        ...,
        description="추출된 개념 리스트 (최대 3개)"
    )


class MatchingResult(BaseModel):
    """매칭 결과 구조화된 출력 모델."""
    
    noun_phrase_summary: str = Field(
        ...,
        description="원본 키워드를 3단어 이내로 요약한 명사구"
    )
    most_similar_concept_id: Optional[str] = Field(
        None,
        description="의미가 가장 유사한 후보 개념 ID"
    )
    matched_concept_id: Optional[str] = Field(
        None,
        description="실제로 매칭된 개념 ID. 합칠 수 있는 경우에만 값이 있음"
    )
    reason: str = Field(
        ...,
        description="합칠 수 있는지 여부와 그 이유. 명사구 요약 과정, 유사한 후보 선택 이유, 합치기 가능 여부 판단 근거를 포함"
    )


class ConceptMatcher:
    """키워드-개념 매칭 (LLM 사용)."""

    def __init__(self, vector_store: VectorStore) -> None:
        """ConceptMatcher 초기화.
        
        Args:
            vector_store: 벡터 스토어 인스턴스
        """
        self.vector_store = vector_store
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.llm = ChatOpenAI(model=model, temperature=0)
        self.structured_llm = self.llm.with_structured_output(MatchingResult)
        self.structured_llm_extraction = self.llm.with_structured_output(ConceptExtractionResult)

    def match(
        self,
        keyword: str,
        context: str,
        candidates: List[Dict[str, Any]],
        section_title: Optional[str] = None,
        original_keyword: Optional[str] = None
    ) -> Dict[str, Any]:
        """LLM으로 최종 매칭 결정.
        
        Args:
            keyword: 매칭할 키워드 (압축된 명사구)
            context: 원본 텍스트 (chunk_text)
            candidates: 후보 개념 리스트
            section_title: 섹션 제목 (매칭 시 활용)
            original_keyword: 원본 키워드 (압축 전)
            
        Returns:
            {"matched": 개념 ID 또는 None, "reason": 매칭 이유, "noun_phrase_summary": 명사구 요약, "most_similar_concept_id": 가장 유사한 개념 ID}
        """
        if not candidates:
            no_candidate_result = MatchingResult(
                matched_concept_id=None,
                noun_phrase_summary="",
                most_similar_concept_id=None,
                reason="후보 개념이 없음"
            )
            result_dict = no_candidate_result.model_dump()
            result_dict["matched"] = None
            return result_dict
        
        return self._call_llm(original_keyword or keyword, context, candidates, section_title)

    def _call_llm(
        self,
        original_keyword: str,
        context: str,
        candidates: List[Dict[str, Any]],
        section_title: Optional[str] = None
    ) -> Dict[str, Any]:
        """LLM 호출하여 매칭 결정.
        
        Args:
            original_keyword: 원본 키워드 (명사구로 요약할 키워드)
            context: 원본 텍스트
            candidates: 후보 개념 리스트
            section_title: 섹션 제목 (매칭 시 활용)
            
        Returns:
            {"matched": 개념 ID 또는 None, "reason": 매칭 이유, "noun_phrase_summary": 명사구 요약, "most_similar_concept_id": 가장 유사한 개념 ID}
        """
        candidates_text = "\n".join([
            f"{idx + 1}. 개념 ID: {c['concept_id']}\n   설명: {c.get('description', '')}"
            for idx, c in enumerate(candidates[:5])
        ])
        
        section_info = f"\n섹션 제목: {section_title}" if section_title else ""

        system_prompt = """당신은 LLM 및 머신러닝 온톨로지 전문가입니다.
이 프로젝트의 목적은 새로운 개념의 출현을 찾는 것입니다.

**핵심 판단 기준:**
주어진 키워드가 기존 개념과 합쳐도 되는 세부적인 개념인지, 아니면 별도로 분류해야 할 중요한 새로운 개념인지를 판단해야 합니다.

**합칠 수 있는 경우 (matched_concept_id에 값 설정):**
1. **동일한 의미**: 키워드와 후보 개념이 같은 개념을 가리키는 경우
   - 동의어: "Large Language Model" = "LLM" = "대규모 언어 모델"
   - 약어와 풀네임: "GPT" = "Generative Pre-trained Transformer"
   - 단순한 표현 방식의 차이: "모델 학습" = "Model Training"

2. **단순한 세부 설명이나 표현**: 키워드가 후보 개념을 설명하는 다른 방식일 뿐인 경우
   - 예: "신경망 학습" → "Neural Network Training" (같은 개념)
   - 예: "딥러닝 모델" → "Deep Learning Model" (같은 개념)

**합치면 안 되는 경우 (matched_concept_id는 None, 새로운 개념):**
키워드가 LLM 엔지니어가 별도 개념으로 공부해야 할 정도로 중요한 경우:

1. **새로운 원리나 방법론**: 독립적인 학습 주제가 되는 새로운 기법
   - 예: "LoRA"는 "Fine-tuning"의 중요한 하위 분류로 독립적으로 분류 필요
   - 예: "LLM style transfer"는 "AugmentationTechnique"의 중요한 응용으로 별도 분류 필요
   - 예: "Transformer"는 "Neural Network"의 중요한 아키텍처로 독립 분류 필요

2. **중요한 하위 분류**: 기존 개념의 하위 분야이지만, 독립적인 개념으로 분류해야 할 정도로 중요한 경우
   - 판단 기준: 이 개념을 모르면 해당 분야를 이해하기 어려운가?
   - 판단 기준: 이 개념이 별도의 학습 자료, 논문, 튜토리얼이 존재하는가?
   - 판단 기준: 이 개념이 다른 개념들과 구별되는 고유한 특성과 원리를 가지는가?

3. **독립적인 추상화 수준**: 기존 개념과 다른 수준의 일반성이나 특수성을 가진 경우
   - 예: "Attention Mechanism"은 "Neural Network"보다 더 구체적이지만 독립적인 개념
   - 예: "BERT"는 "Language Model"의 특정 구현체이지만 독립적인 개념

**판단 시 고려사항:**
- 키워드가 독립적인 학습 주제가 되는가?
- 키워드가 별도의 논문, 문서, 튜토리얼이 존재하는가?
- 키워드를 모르면 해당 분야를 이해하기 어려운가?
- 키워드가 고유한 원리나 방법론을 제시하는가?"""

        user_prompt = f"""다음 정보를 바탕으로 키워드를 온톨로지 개념과 매칭해주세요.

**원본 키워드:** {original_keyword}
{section_info}

**원본 문단 (키워드가 추출된 텍스트):**
{context[:800]}

**온톨로지 후보 개념들:**
{candidates_text}

**판단 과정:**

1. **명사구 요약**: 원본 키워드에서 실제 개념만 추출하여 3단어 이내의 명사구로 요약하세요.
   - 핵심 원칙: 온톨로지에 들어갈 "실제 개념"만 추출하세요. 문서 구조를 나타내는 단어는 제거하세요.
   - 제거해야 할 단어: "Overview", "Introduction", "Mastering", "Guide", "Tutorial", "Complete", "Deep Dive", "Basics", "Fundamentals", "Advanced" 등
   - 예시:
     * "LLM Twin Overview" → "LLM Twin" (Overview는 문서 구조 단어이므로 제거)
     * "Introduction to RAG" → "RAG" (Introduction to는 문서 구조 단어이므로 제거)
     * "Mastering Fine-tuning" → "Fine-tuning" (Mastering은 문서 구조 단어이므로 제거)
     * "Transformer Architecture" → "Transformer Architecture" (둘 다 실제 개념이므로 유지)
   - 판단 기준: 이 단어가 온톨로지의 독립적인 개념으로 존재할 수 있는가? 문서 제목의 일부일 뿐인가?
   - 가능하다면 적은 단어로 요약하되, 핵심 개념은 유지하세요.

2. **유사한 후보 선택**: 요약한 명사구와 의미가 가장 유사한 후보 개념을 선택하세요.
   - 개념 ID와 설명을 모두 고려하여 의미적 유사도 판단

3. **합치기 가능 여부 판단**: 선택한 후보 개념과 요약한 키워드를 합칠 수 있는지 판단하세요.
   - 합칠 수 있는 경우: 동일한 의미이거나, 키워드가 후보의 세부적인 하위 분야로 합쳐도 무방한 경우
   - 합치면 안 되는 경우: 키워드가 별도 개념으로 분류해야 할 정도로 중요한 새로운 개념인 경우

**응답 요구사항:**
- noun_phrase_summary: 3단어 이내 명사구 요약 (문서 구조 단어 제거 후 핵심 개념만)
- most_similar_concept_id: 의미가 가장 유사한 후보 개념 ID (없으면 None)
- matched_concept_id: 실제로 합칠 수 있는 경우에만 값 설정 (합치면 안 되면 None)
- reason: 명사구 요약 방법, 유사한 후보 선택 이유, 합치기 가능 여부 판단 근거를 포함한 상세 설명"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        try:
            result = self.structured_llm.invoke(messages)
            
            # 후보 검증만 수행
            if result.matched_concept_id:
                if result.matched_concept_id not in [c["concept_id"] for c in candidates]:
                    result.matched_concept_id = None
            
            # MatchingResult를 딕셔너리로 변환하고 기존 코드 호환을 위해 "matched" 키 추가
            result_dict = result.model_dump()
            result_dict["matched"] = result_dict.pop("matched_concept_id")
            return result_dict
        
        except Exception as e:
            error_result = MatchingResult(
                matched_concept_id=None,
                noun_phrase_summary="",
                most_similar_concept_id=None,
                reason=f"오류 발생: {str(e)}"
            )
            result_dict = error_result.model_dump()
            result_dict["matched"] = None
            return result_dict

    def extract_noun_phrases_from_keyword(
        self,
        original_keyword: str,
        chunk_text: str,
        section_title: Optional[str] = None,
        top_level_categories: Optional[List[str]] = None
    ) -> List[str]:
        """original keyword에서 중복되지 않는 noun phrase를 최대 3개까지 추출.
        
        Args:
            original_keyword: 원본 키워드
            chunk_text: 원본 텍스트 청크 (맥락 제공용)
            section_title: 섹션 제목 (선택)
            
        Returns:
            추출된 noun phrase 리스트 (최대 3개, 중복 제거)
        """
        section_info = f"\n섹션 제목: {section_title}" if section_title else ""
        
        categories_info = ""
        if top_level_categories:
            categories_info = f"""
**온톨로지 1depth 카테고리 (LLMConcept의 직접 자식):**
{', '.join(top_level_categories)}

이 카테고리에 속할 수 있다는 것은 LLM/머신러닝/AI 도메인 특화 개념이라는 의미입니다.
"""
        
        system_prompt = """당신은 LLM 및 머신러닝 온톨로지 전문가입니다.
키워드에서 핵심 기술 개념만 추출하세요 (최대 3개, 3단어 이내 명사구). 텍스트 맥락은 참고용이며, 키워드에 실제로 언급된 개념만 추출해야 합니다.

**핵심 원칙:**
1. **절대 키워드 전체를 반환하지 마세요. 핵심 기술 개념/용어만 추출하세요**
   - ❌ "Strategic advantages of implementing a Minimum Viable Product" (전체 키워드)
   - ✅ "Minimum Viable Product" 또는 "MVP" (핵심 개념만)
   - ❌ "Definition and purpose of a Minimum Viable Product (MVP)" (전체 키워드)
   - ✅ "Minimum Viable Product" 또는 "MVP" (핵심 개념만)
   - **키워드에서 핵심 개념만 식별하고, 그것만 추출하세요**
2. 온톨로지의 1depth 카테고리(LLMConcept의 직접 자식)의 하위에 속하는 구체적인 기술 개념 또는 LLM 관련 개발에 필수적인 개념 추출
   - ❌ "AgentArchitecture", "KnowledgeIntegration", "EvaluationMetric" (1depth 카테고리 자체)
   - ✅ "LLMAgent", "RAG", "HumanEvaluation" (1depth 카테고리의 하위 개념)
   - ✅ "MVP", "Agile", "CI/CD" (LLM 관련 개발에 필수적인 개념)
   - 이 카테고리의 하위에 속할 수 있거나, LLM 관련 개발에 필수적인 개념이라는 의미
3. 원본 키워드에 언급된 개념만 (mentioned_in_keyword: True)
4. 일반 표현은 기술 개념으로 변환 가능 (예: "content creation" → "TextGeneration")

**추출 기준:**
- 기술적/학술적 용어이거나 전문 용어
- LLM 엔지니어가 별도로 학습해야 할 정도로 중요한 개념
- 독립적인 학습 주제가 될 수 있는 개념
- 온톨로지의 1depth 카테고리의 하위에 속하는 구체적인 기술 개념 우선
- LLM 관련 개발에 필수적인 개념도 포함 가능 (예: MVP, Agile, CI/CD 등)

**mentioned_in_keyword 판단:**
- True: 원본 키워드에 직접 언급되거나 명확하게 암시된 개념
- False: chunk_text에만 있고 원본 키워드에는 없는 개념 (추출하지 마세요)

**개념 변환:**
- 일반적인 표현이 온톨로지의 기술 개념과 동의어이거나 밀접하게 관련이 있는 경우 변환 가능
- 예: "content creation" → "TextGeneration", "model training" → "Training" 또는 "Finetuning"
- 변환된 개념도 원본 키워드에 명확하게 암시되어야 하며, mentioned_in_keyword는 True

**제외 대상:**
- 1depth 카테고리 자체 (예: "AgentArchitecture", "KnowledgeIntegration", "EvaluationMetric" 등)
- "LLM", "AI" (Large Language Model, Artificial Intelligence) - 이 두 용어는 추출하지 마세요
- 일반적인 영어 표현 ("end goal", "solid intuition", "good practice" 등)
- 추상적이고 모호한 표현 ("importance", "understanding", "concept" 등)
- 문서 구조 단어 (Overview, Introduction, Guide 등)
- 온톨로지의 1depth 카테고리 하위에 속할 수 없는 일반적인 단어
"""
        
        user_prompt = f"""다음 키워드에서 온톨로지의 1depth 카테고리의 하위에 속하는 구체적인 기술 개념 또는 LLM 관련 개발에 필수적인 개념인 noun phrase를 최대 3개까지 추출해주세요.

{section_info}
{categories_info}

**원본 키워드:** {original_keyword}
**텍스트 맥락 (참고용):** {chunk_text[:800]}

**실행 지시:**
- **절대 키워드 전체를 반환하지 마세요. 핵심 기술 개념만 추출하세요**
  - ❌ "Strategic advantages of implementing a Minimum Viable Product" (전체 키워드)
  - ✅ "Minimum Viable Product" 또는 "MVP" (핵심 개념만)
  - ❌ "Definition and purpose of a Minimum Viable Product (MVP)" (전체 키워드)
  - ✅ "Minimum Viable Product" 또는 "MVP" (핵심 개념만)
  - 예: "Challenges in personal brand content creation requiring LLM Twin assistance" → "LLM Twin", "TextGeneration"
- 1depth 카테고리 자체는 추출하지 마세요 (예: "AgentArchitecture" ❌, "LLMAgent" ✅)
- LLM 관련 개발에 필수적인 개념도 포함 가능 (예: MVP, Agile, CI/CD 등)
- 키워드에 언급된 개념만 (mentioned_in_keyword: True)
- 일반 표현은 기술 개념으로 변환 (예: "content creation" → "TextGeneration")
- 중복되지 않는 중요한 noun phrase만 추출
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        try:
            result = self.structured_llm_extraction.invoke(messages)
            
            noun_phrases = []
            seen = set()
            
            # 1depth 카테고리 목록을 소문자로 변환하여 비교용으로 준비
            top_level_categories_lower = set()
            if top_level_categories:
                top_level_categories_lower = {cat.lower() for cat in top_level_categories}
            
            for extracted_concept in result.concepts[:3]:
                noun_phrase = extracted_concept.concept.strip()
                noun_phrase_lower = noun_phrase.lower()
                
                # original keyword에 실제로 언급된 개념만 포함
                if not extracted_concept.mentioned_in_keyword:
                    continue
                
                # 1depth 카테고리와 동일한 개념은 제외
                if top_level_categories_lower and noun_phrase_lower in top_level_categories_lower:
                    continue
                
                if noun_phrase and noun_phrase_lower not in seen:
                    seen.add(noun_phrase_lower)
                    noun_phrases.append(noun_phrase)
            
            return noun_phrases[:3]
        
        except Exception as e:
            return []

