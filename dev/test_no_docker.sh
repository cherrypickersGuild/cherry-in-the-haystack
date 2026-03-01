#!/bin/bash
set -e

# 0. 환경 설정
export AIRFLOW_HOME=~/airflow
mkdir -p $AIRFLOW_HOME/dags
mkdir -p $AIRFLOW_HOME/run/auto-news/src
mkdir -p $AIRFLOW_HOME/data/news

echo "=== Local No-Docker Test Setup ==="

# 1. 소스 코드 배포 (airflow가 실행될 때 참조하는 경로로 복사)
# DAG 파일에서 '~/airflow/run/auto-news/src' 경로를 하드코딩해서 참조하고 있음
echo "Copying source code to $AIRFLOW_HOME/run/auto-news/src..."
cp -r apps/api/src/* $AIRFLOW_HOME/run/auto-news/src/

echo "Copying DAGs to $AIRFLOW_HOME/dags..."
cp -r apps/api/dags/* $AIRFLOW_HOME/dags/

# Copy .env file if it exists
if [ -f "apps/api/.env" ]; then
    echo "Copying .env to runtime directory..."
    cp apps/api/.env $AIRFLOW_HOME/run/auto-news/src/.env
else
    echo "WARNING: apps/api/.env NOT FOUND. Please create it from .env.template."
fi

# Activate virtual environment
if [ -f "apps/api/venv/bin/activate" ]; then
    echo "Activating existing virtual environment..."
    source apps/api/venv/bin/activate
else
    echo "Creating new virtual environment at apps/api/venv..."
    python3 -m venv apps/api/venv
    source apps/api/venv/bin/activate
fi

# 2. 의존성 설치 확인
echo "Checking dependencies..."
if ! command -v airflow &> /dev/null; then
    echo "Installing Apache Airflow..."
    pip install apache-airflow
fi

# 프로젝트 필수 패키지 설치
echo "Installing project requirements..."
pip install -r apps/api/docker/requirements.txt
pip install google-generativeai langchain-google-genai feedparser notion-client

# 3. Airflow DB 초기화 (처음 실행 시 필요)
if [ ! -f "$AIRFLOW_HOME/airflow.db" ]; then
    echo "Initializing Airflow DB..."
    airflow db init
fi

# 4. DAG 테스트 실행
echo "Testing 'news_pulling' DAG..."
# 오늘 날짜로 테스트 실행
airflow dags test news_pulling $(date +%Y-%m-%d)
