#!/bin/bash
# 터미널 창 없이 백그라운드에서 실행하기 위한 스크립트
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin:~/.npm-global/bin
cd /Users/fitogether/Desktop/Manage
docker-compose up -d

# 기존 프로세스 정리
lsof -ti:3005 | xargs kill -9 2>/dev/null || true

# 백엔드 서버 자동 재시작 루프 (OOM 크래시 방지 및 자동 복구)
run_backend() {
  while true; do
    echo "[$(date)] Starting Next.js backend server with 4GB heap..." >> ./app.log
    NODE_OPTIONS="--max-old-space-size=4096" npm run dev -- -p 3005 >> ./app.log 2>&1
    echo "[$(date)] Next.js backend server stopped. Restarting in 2 seconds..." >> ./app.log
    sleep 2
  done
}

run_backend &
npx electron main.js >> ./app.log 2>&1 &

