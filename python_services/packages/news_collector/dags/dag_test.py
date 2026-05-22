import os
import subprocess
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

RUN_ID = f"manual__{datetime.utcnow().isoformat()}"
START_DATE = datetime.utcnow().strftime("%Y-%m-%d")
JOB_ID = "local_test_job"
DATA_FOLDER = "data/news"


def run_cmd(cmd: str):
    print(f"\n🚀 Running:\n{cmd}\n")
    result = subprocess.run(cmd, shell=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"❌ Command failed: {cmd}")


def main():
    print(f"RUN_ID: {RUN_ID}")

    # 1. start
    run_cmd(f"""
    python af_start.py --start {START_DATE} --prefix=./run
    """)

    # 2. prepare
    data_path = os.path.expanduser(f"~/airflow/{DATA_FOLDER}/{RUN_ID}")
    os.makedirs(data_path, exist_ok=True)
    print(f"📁 Created folder: {data_path}")

    # 3. pull
    run_cmd(f"""
    python af_pull.py \
        --start {START_DATE} \
        --prefix=./run \
        --run-id={RUN_ID} \
        --job-id={JOB_ID} \
        --data-folder="{DATA_FOLDER}" \
        --sources=RSS
    """)

    # 4. save
    run_cmd(f"""
    python af_save.py \
        --start {START_DATE} \
        --prefix=./run \
        --run-id={RUN_ID} \
        --job-id={JOB_ID} \
        --data-folder="{DATA_FOLDER}" \
        --targets=notion \
        --dedup=True \
        --sources=RSS
    """)

    # 5. finish
    run_cmd(f"""
    python af_end.py \
        --start {START_DATE} \
        --prefix=./run
    """)

    print("\n✅ 전체 파이프라인 정상 실행 완료")


if __name__ == "__main__":
    main()