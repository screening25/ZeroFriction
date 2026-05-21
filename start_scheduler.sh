#!/bin/bash
# 터미널 창 없이 백그라운드에서 실행하기 위한 스크립트
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin:~/.npm-global/bin
cd /Users/fitogether/Desktop/Manage
docker-compose up -d

# 기존 프로세스 정리
lsof -ti:3005 | xargs kill -9 2>/dev/null || true

# 백엔드 서버 및 Electron 앱 백그라운드 실행
npm run dev -- -p 3005 > ./app.log 2>&1 &
npx electron main.js >> ./app.log 2>&1 &

