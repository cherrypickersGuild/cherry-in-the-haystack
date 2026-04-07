#!/bin/bash
# GraphDB 도커 세팅 및 온톨로지 로드 스크립트

set -e

GRAPHDB_IMAGE="ontotext/graphdb:10.7.0"
CONTAINER_NAME="graphdb-ontology"
GRAPHDB_PORT=7200
REPOSITORY_ID="llm-ontology"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
CONFIG_PATH="$DATA_DIR/config.ttl"
TTL_PATH="$DATA_DIR/llm_ontology.ttl"
GRAPHDB_URL="http://localhost:$GRAPHDB_PORT"

echo "GraphDB 세팅 시작..."
echo "데이터 디렉토리: $DATA_DIR"
echo "Config 경로: $CONFIG_PATH"
echo "TTL 경로: $TTL_PATH"

if ! docker info >/dev/null 2>&1; then
    echo "Docker가 실행되지 않았습니다."
    exit 1
fi

if [ ! -f "$CONFIG_PATH" ]; then
    echo "Config 파일을 찾을 수 없습니다: $CONFIG_PATH"
    exit 1
fi

if [ ! -f "$TTL_PATH" ]; then
    echo "TTL 파일을 찾을 수 없습니다: $TTL_PATH"
    exit 1
fi

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "기존 컨테이너 제거: $CONTAINER_NAME"
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

DATA_VOLUME="$HOME/.graphdb-data"
mkdir -p "$DATA_VOLUME"

echo "GraphDB 컨테이너 시작..."
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$GRAPHDB_PORT:7200" \
    -v "$DATA_VOLUME:/opt/graphdb/home" \
    -e GDB_HEAP_SIZE=1g \
    "$GRAPHDB_IMAGE"

echo "GraphDB 준비 대기 중 (최대 2분)..."
READY=false
for i in {1..60}; do
    if curl -s "$GRAPHDB_URL/rest/repositories" >/dev/null 2>&1; then
        echo ""
        echo "GraphDB 준비 완료!"
        READY=true
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if [ "$READY" = false ]; then
    echo "GraphDB 시작 대기 시간 초과"
    echo "컨테이너 로그 확인:"
    docker logs "$CONTAINER_NAME" | tail -20
    exit 1
fi

sleep 3

echo "Repository 확인 중..."
REPO_EXISTS=$(curl -s "$GRAPHDB_URL/rest/repositories" | grep -c "\"id\":\"$REPOSITORY_ID\"" || true)
if [ -z "$REPO_EXISTS" ]; then
    REPO_EXISTS=0
fi

if [ "$REPO_EXISTS" -gt 0 ]; then
    echo "기존 Repository '$REPOSITORY_ID' 삭제 중..."
    curl -X DELETE "$GRAPHDB_URL/rest/repositories/$REPOSITORY_ID" 2>/dev/null
    sleep 2
fi

echo "Repository '$REPOSITORY_ID' 생성 중..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -F "config=@$CONFIG_PATH" \
    "$GRAPHDB_URL/rest/repositories")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "Repository 생성 완료!"
else
    echo "Repository 생성 실패 (HTTP $HTTP_CODE)"
    echo "$RESPONSE"
    exit 1
fi

sleep 2

echo "온톨로지 로드 중: $TTL_PATH"
LOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: text/turtle" \
    --data-binary "@$TTL_PATH" \
    "$GRAPHDB_URL/repositories/$REPOSITORY_ID/statements")

LOAD_HTTP_CODE=$(echo "$LOAD_RESPONSE" | tail -n 1)
if [ "$LOAD_HTTP_CODE" = "204" ] || [ "$LOAD_HTTP_CODE" = "200" ]; then
    echo "온톨로지 로드 완료!"
else
    echo "온톨로지 로드 실패 (HTTP $LOAD_HTTP_CODE)"
    echo "$LOAD_RESPONSE" | sed '$d'
    echo ""
    echo "GraphDB 로그 확인:"
    docker logs "$CONTAINER_NAME" | tail -20
    exit 1
fi

sleep 1

TRIPLE_COUNT=$(curl -s "$GRAPHDB_URL/repositories/$REPOSITORY_ID/size")
echo "로드된 트리플 수: $TRIPLE_COUNT"

echo ""
echo "============================================================"
echo "GraphDB 세팅 완료!"
echo "============================================================"
echo "GraphDB URL: $GRAPHDB_URL"
echo "Repository: $REPOSITORY_ID"
echo "SPARQL Endpoint: $GRAPHDB_URL/repositories/$REPOSITORY_ID"
echo ""
echo "컨테이너 중지: docker stop $CONTAINER_NAME"
echo "컨테이너 제거: docker rm $CONTAINER_NAME"
