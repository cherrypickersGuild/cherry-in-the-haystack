from langchain_core.prompts import ChatPromptTemplate
from tqdm import tqdm

from src.workflow.state import PipelineState
from src.model.model import get_default_llm, parse_json_response
from src.model.schemas import ExtractedIdea, HierarchicalChunk
from src.prompts.extraction import EXTRACTION_PROMPT, HUMAN_PROMPT
from src.utils.pdf.hierarchy_detector import split_into_paragraphs
from src.db.connection import get_session
from src.db.models import ParagraphChunk as DBParagraphChunk, KeyIdea, ParagraphEmbedding
from src.workflow.utils import get_concept_from_idea
from python_services.packages.text_extract_ideas.src.dedup.dedup_service import DeduplicationService
from python_services.packages.text_extract_ideas.src.dedup.hash_utils import compute_paragraph_hash, compute_simhash64
from python_services.packages.text_extract_ideas.src.dedup.embedding_utils import compute_embedding


def process_section(state: PipelineState) -> PipelineState:
    """
    현재 섹션 처리: 청킹 → 아이디어 추출 → 저장.
    all_sections[current_section_index]의 섹션을 처리하고
    인덱스를 증가시킴.
    """
    all_sections = state.get("all_sections", [])
    current_idx = state.get("current_section_index", 0)
    book_id = state.get("book_id")
    total_sections = len(all_sections)

    # 범위 체크
    if current_idx >= total_sections:
        return state

    section_info = all_sections[current_idx]
    chapter = section_info["chapter"]
    section = section_info["section"]
    chapter_id = section_info.get("chapter_id")
    section_id = section_info.get("section_id")
    hierarchy_path = section_info.get("hierarchy_path", "")

    section_text = section.content
    stats = state.get("stats", {})
    enable_semantic_dedup = state.get("enable_semantic_dedup", False)
    semantic_threshold = state.get("semantic_threshold", 0.95)

    # 진행률 표시
    progress_pct = (current_idx + 1) / total_sections * 100
    section_title = section.title[:30] + "..." if len(section.title) > 30 else section.title
    print(f"\r📝 [{current_idx + 1}/{total_sections}] ({progress_pct:.1f}%) {chapter.title[:20]}.. > {section_title}", end="", flush=True)

    # 너무 짧은 섹션 스킵
    if len(section_text.strip()) < 100:
        return {
            **state,
            "current_section_index": current_idx + 1,
            "stats": stats,
        }

    try:
        # 1. 청킹 (LLM 기반 문단 분할)
        chunks = _chunk_section(
            section_text=section_text,
            section_title=section.title,
            chapter_id=chapter_id,
            chapter_title=chapter.title,
            hierarchy_path=hierarchy_path,
            section_level=section.level,
        )

        stats["total_paragraphs"] = stats.get("total_paragraphs", 0) + len(chunks)

        # 2. 각 청크 처리: 중복 체크 → 아이디어 추출 → 아이디어 중복 체크 → 저장
        for i, chunk in enumerate(chunks):
            chunk.section_id = section_id

            # 앞뒤 문단 컨텍스트 추출
            prev_text = chunks[i - 1].text if i > 0 else ""
            next_text = chunks[i + 1].text if i < len(chunks) - 1 else ""

            result = _process_chunk(
                chunk=chunk,
                book_id=book_id,
                chapter_id=chapter_id,
                section_id=section_id,
                prev_text=prev_text,
                next_text=next_text,
                enable_semantic_dedup=enable_semantic_dedup,
                semantic_threshold=semantic_threshold,
            )

            if result.get("saved"):
                stats["total_ideas"] = stats.get("total_ideas", 0) + 1
            if result.get("is_chunk_duplicate"):
                stats["dedup_skipped_hash"] = stats.get("dedup_skipped_hash", 0) + 1
                stats["duplicates_skipped"] = stats.get("duplicates_skipped", 0) + 1
            if result.get("is_idea_duplicate"):
                stats["dedup_skipped_idea"] = stats.get("dedup_skipped_idea", 0) + 1
                stats["duplicates_skipped"] = stats.get("duplicates_skipped", 0) + 1

        stats["completed_sections"] = stats.get("completed_sections", 0) + 1

    except Exception as e:
        stats["failed_sections"] = stats.get("failed_sections", 0) + 1
        print(f"   ⚠️ 섹션 '{section.title}' 처리 실패: {e}")

    return {
        **state,
        "current_section_index": current_idx + 1,
        "stats": stats,
    }


def _chunk_section(
    section_text: str,
    section_title: str,
    chapter_id: int,
    chapter_title: str,
    hierarchy_path: str,
    section_level: int,
) -> list[HierarchicalChunk]:
    """섹션을 청크로 분할."""
    try:
        # LLM 기반 문단 분할
        paragraphs = split_into_paragraphs(
            text=section_text,
            section_title=section_title,
        )

        chunks = []
        for i, para in enumerate(paragraphs):
            chunk = HierarchicalChunk(
                text=para["text"],
                chapter_id=chapter_id,
                chapter_title=chapter_title,
                section_title=section_title,
                paragraph_index=i,
                chapter_paragraph_index=i,
                start_char=para.get("start_char", 0),
                end_char=para.get("end_char", 0),
                section_level=section_level,
                detection_method="llm",
                hierarchy_path=hierarchy_path,
            )
            chunks.append(chunk)

        return chunks

    except Exception:
        # 폴백: 간단한 분할
        return _simple_split(
            text=section_text,
            chapter_id=chapter_id,
            chapter_title=chapter_title,
            section_title=section_title,
            hierarchy_path=hierarchy_path,
        )


def _simple_split(
    text: str,
    chapter_id: int = None,
    chapter_title: str = None,
    section_title: str = None,
    hierarchy_path: str = "",
    min_length: int = 100,
    max_length: int = 1500,
) -> list[HierarchicalChunk]:
    """간단한 규칙 기반 텍스트 분할 (폴백용)."""
    raw_chunks = text.split("\n\n")
    chunks = []
    current_chunk = ""
    paragraph_index = 0
    char_offset = 0

    for raw in raw_chunks:
        raw = raw.strip()
        if not raw:
            continue

        if current_chunk:
            current_chunk += "\n\n" + raw
        else:
            current_chunk = raw

        if len(current_chunk) >= max_length:
            if len(current_chunk) >= min_length:
                chunks.append(HierarchicalChunk(
                    text=current_chunk,
                    chapter_id=chapter_id,
                    chapter_title=chapter_title,
                    section_title=section_title,
                    paragraph_index=paragraph_index,
                    chapter_paragraph_index=paragraph_index,
                    start_char=char_offset,
                    end_char=char_offset + len(current_chunk),
                    detection_method="fallback",
                    hierarchy_path=hierarchy_path,
                ))
                char_offset += len(current_chunk)
                paragraph_index += 1
            current_chunk = ""

    if current_chunk and len(current_chunk) >= min_length:
        chunks.append(HierarchicalChunk(
            text=current_chunk,
            chapter_id=chapter_id,
            chapter_title=chapter_title,
            section_title=section_title,
            paragraph_index=paragraph_index,
            chapter_paragraph_index=paragraph_index,
            start_char=char_offset,
            end_char=char_offset + len(current_chunk),
            detection_method="fallback",
            hierarchy_path=hierarchy_path,
        ))

    return chunks


def _process_chunk(
    chunk: HierarchicalChunk,
    book_id: int,
    chapter_id: int,
    section_id: int,
    prev_text: str = "",
    next_text: str = "",
    enable_semantic_dedup: bool = False,
    semantic_threshold: float = 0.95,
) -> dict:
    """
    단일 청크 처리: 중복 체크 → 아이디어 추출 → 아이디어 중복 체크 → 저장.

    Returns:
        {"saved": bool, "is_chunk_duplicate": bool, "is_idea_duplicate": bool, "error": str | None}
    """
    chunk_text = chunk.text

    if not chunk_text or len(chunk_text.strip()) < 50:
        return {"saved": False, "is_chunk_duplicate": False, "is_idea_duplicate": False}

    try:
        # 0. 청크 중복 체크 (해시 기반) - LLM 호출 전에 실행
        chunk_para_hash = compute_paragraph_hash(chunk_text)
        chunk_simhash = compute_simhash64(chunk_text)

        # 해시 기반 중복 체크
        session = get_session()
        try:
            # 정확한 해시 매칭
            hash_match = session.query(DBParagraphChunk.id).filter(
                DBParagraphChunk.paragraph_hash == chunk_para_hash
            ).first()
            if hash_match:
                session.close()
                return {"saved": False, "is_chunk_duplicate": True, "is_idea_duplicate": False}

            # SimHash 퍼지 매칭 (시맨틱 중복제거 활성화 시)
            if enable_semantic_dedup:
                # SimHash 체크
                simhash_match = session.query(DBParagraphChunk.id).filter(
                    DBParagraphChunk.simhash64.isnot(None)
                ).first()
                # TODO: SimHamming 거리 계산 추가 필요

                # 임베딩 기반 의미적 중복 체크
                dedup_service = DeduplicationService(
                    session=session,
                    semantic_threshold=semantic_threshold,
                    enable_semantic=True,
                )
                semantic_result = dedup_service.check_duplicate(chunk_text, book_id)
                if semantic_result.is_duplicate:
                    session.close()
                    return {"saved": False, "is_chunk_duplicate": True, "is_idea_duplicate": False, "duplicate_type": semantic_result.duplicate_type}
        finally:
            session.close()

        # 1. 아이디어 추출 (컨텍스트 포함)
        extracted_idea = _extract_idea(
            chunk_text,
            hierarchy_path=chunk.hierarchy_path,
            prev_text=prev_text,
            next_text=next_text,
        )

        if not extracted_idea:
            return {"saved": False, "is_chunk_duplicate": False, "is_idea_duplicate": False}

        # 2. 아이디어 중복 체크
        concept = get_concept_from_idea(extracted_idea)
        is_duplicate = _check_duplicate(concept, book_id)

        if is_duplicate:
            return {"saved": False, "is_chunk_duplicate": False, "is_idea_duplicate": True}

        # 3. DB 저장
        _save_to_db(
            chunk=chunk,
            extracted_idea=extracted_idea,
            book_id=book_id,
            chapter_id=chapter_id,
            section_id=section_id,
            chunk_para_hash=chunk_para_hash,
            chunk_simhash=chunk_simhash,
            enable_semantic_dedup=enable_semantic_dedup,
        )

        return {"saved": True, "is_chunk_duplicate": False, "is_idea_duplicate": False}

    except Exception as e:
        return {"saved": False, "is_chunk_duplicate": False, "is_idea_duplicate": False, "error": str(e)}


def _get_first_sentence(text: str) -> str:
    """텍스트의 첫 문장 추출 (최대 150자)."""
    if not text:
        return "N/A"
    # 첫 문장 추출 (마침표, 물음표, 느낌표 기준)
    for i, char in enumerate(text):
        if char in '.?!' and i > 20:  # 최소 20자 이후
            return text[:i+1].strip()[:150]
    # 마침표가 없으면 첫 150자
    return text[:150].strip() + "..." if len(text) > 150 else text.strip()


def _extract_idea(
    chunk_text: str,
    hierarchy_path: str = "",
    prev_text: str = "",
    next_text: str = "",
) -> ExtractedIdea | None:
    """청크에서 아이디어 추출 (컨텍스트 정보 포함)."""
    try:
        llm = get_default_llm()

        json_instruction = "\n\nReturn ONLY valid JSON (no markdown):\n{{\"concept\": \"5-10 word descriptive noun phrase\"}}"

        prompt = ChatPromptTemplate.from_messages([
            ("system", EXTRACTION_PROMPT + json_instruction),
            ("human", HUMAN_PROMPT),
        ])

        messages = prompt.format_messages(
            text=chunk_text,
            hierarchy_path=hierarchy_path or "N/A",
            prev_summary=_get_first_sentence(prev_text),
            next_summary=_get_first_sentence(next_text),
        )
        response = llm.invoke(messages)
        data = parse_json_response(response.content)
        return ExtractedIdea(**data)

    except Exception:
        return None


def _check_duplicate(concept: str, book_id: int) -> bool:
    """중복 아이디어 체크."""
    if not concept:
        return False

    try:
        session = get_session()
        try:
            query = session.query(KeyIdea).filter(
                KeyIdea.core_idea_text == concept
            )
            if book_id:
                query = query.filter(KeyIdea.book_id == book_id)

            return query.first() is not None
        finally:
            session.close()
    except Exception:
        return False


def _save_to_db(
    chunk: HierarchicalChunk,
    extracted_idea: ExtractedIdea,
    book_id: int,
    chapter_id: int,
    section_id: int,
    chunk_para_hash: str = None,
    chunk_simhash: int = None,
    enable_semantic_dedup: bool = False,
) -> None:
    """청크와 아이디어를 DB에 저장 (해시 및 임베딩 포함)."""
    session = get_session()
    try:
        # ParagraphChunk 저장 (해시 포함)
        db_chunk = DBParagraphChunk(
            book_id=book_id,
            chapter_id=chapter_id,
            section_id=section_id,
            paragraph_index=chunk.paragraph_index,
            chapter_paragraph_index=chunk.chapter_paragraph_index,
            body_text=chunk.text,
            paragraph_hash=chunk_para_hash,
            simhash64=chunk_simhash,
        )
        session.add(db_chunk)
        session.flush()

        # 임베딩 저장 (시맨틱 중복제거 활성화 시)
        if enable_semantic_dedup:
            try:
                embedding_result = compute_embedding(chunk.text)
                db_embedding = ParagraphEmbedding(
                    chunk_id=db_chunk.id,
                    book_id=book_id,
                    embedding=embedding_result.embedding,
                    model_name=embedding_result.model,
                )
                session.add(db_embedding)
            except Exception as e:
                # 임베딩 생성 실패해도 청크는 저장
                print(f"   ⚠️ 임베딩 생성 실패 (무시): {e}")

        # KeyIdea 저장
        concept = get_concept_from_idea(extracted_idea)
        db_idea = KeyIdea(
            chunk_id=db_chunk.id,
            book_id=book_id,
            core_idea_text=concept,
        )
        session.add(db_idea)
        session.commit()

    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def route_sections(state: PipelineState) -> str:
    """
    섹션 순회 라우터.

    다음 섹션이 있으면 'continue', 없으면 'finalize'.
    """
    current_idx = state.get("current_section_index", 0)
    all_sections = state.get("all_sections", [])

    if current_idx < len(all_sections):
        return "continue"
    else:
        return "finalize"
