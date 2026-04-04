```
sudo apt install -y postgresql-16-pgvector
sudo systemctl restart postgresql
```
# 3000번 포트 쓰고 있는 프로세스 강제 종료
sudo fuser -k 3000/tcp


# nohup과 env를 사용하여 안전하게 실행
nohup env PORT=3000 pnpm start > output.log 2>&1 &
# 현재 터미널 세션과 연결 끊기 (창 닫아도 유지되게 함)
disown