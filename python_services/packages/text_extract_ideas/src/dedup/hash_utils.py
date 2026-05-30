import hashlib
import re
from typing import Tuple

def normalize_for_hash(text: str) -> str:
    """해싱 전 텍스트 정규화(소문자 변환, 연속 공백을 단일 공백으로, 앞뒤 공백 제거, 구두점 선택적 제거)"""
    text = text.lower() #소문자 변환
    text = re.sub(r'\s+', ' ', text) #연속 공백 > 단일 공백
    text = text.strip() #앞뒤 공백 제거

    return text

def compute_paragraph_hash(text: str) -> str:
    """SHA-256 해시 계산 (정확 매칭용)"""
    normalized = normalize_for_hash(text)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

def compute_simhash64(text: str, ngram_size: int = 3) -> int:
    """64비트 SimHash 계산(유사 매칭용)"""
    normalized = normalize_for_hash(text)
    ngrams = []
    for i in range((len(normalized) - ngram_size + 1)):
        ngrams.append(normalized[i:i + ngram_size])

    if not ngrams:
        return 0

    weights= [0] * 64 #64비트 가중치 벡터 초기화

    for ngram in ngrams:
        h = int(hashlib.md5(ngram.encode('utf-8')).hexdigest()[:16],16)

        #각 비트 위치에 가중치 적용
        for i in range(64):
            bit = (h>>i) & 1
            if bit:
                weights[i] += 1
            else:
                weights[i] -= 1
    

    #최종 fingerprint 생성
    fingerprint = 0
    for i in range(64):
        if weights[i] > 0:
            fingerprint |= (1<<i)

    #unsigned -> signed 변환(postgreSQL BIGINT 호환)
    #2^63 이상이면 음수로 변환
    if fingerprint >= (1 <<63):
        fingerprint -= (1<<64)
    return fingerprint

def hamming_distance(hash1: int, hash2: int) -> int:
    """두 simhash간 해밍 거리 계산"""
    xor = hash1 ^ hash2
    # signed 음수의 경우 64비트로 마스킹
    xor = xor & 0xFFFFFFFFFFFFFFFF
    return bin(xor).count('1')

def is_fuzzy_duplicate(hash1: int, hash2: int, threshold: int = 6) -> bool:
    """퍼지 중복 여부 판단.
    """
    return hamming_distance(hash1, hash2) <= threshold


def compute_hashes(text: str) -> Tuple[str, int]:
    """paragraph_hash와 simhash64를 한번에 계산.
    """
    return compute_paragraph_hash(text), compute_simhash64(text)