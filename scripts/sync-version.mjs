// 버전 단일 소스화(single source of truth)
// ─────────────────────────────────────────────
// 앱 버전의 "진짜 출처"는 SettingsSection.tsx의 VERSION_LOGS[0].version 하나다.
// (릴리스마다 거기 맨 위에 새 버전 항목을 추가한다 — 화면 '업데이트 정보'에 그대로 노출됨)
// 이 스크립트는 그 값을 읽어 package.json의 version을 자동으로 맞춘다.
// npm의 prebuild 라이프사이클로 build 직전에 실행되어, 두 곳이 어긋날 일이 없게 한다.
// 어떤 경우에도 빌드를 깨뜨리지 않도록 항상 exit 0 한다.

import { readFileSync, writeFileSync } from 'node:fs';

try {
  const logsUrl = new URL('../src/frontend/components/SettingsSection.tsx', import.meta.url);
  const src = readFileSync(logsUrl, 'utf8');
  // VERSION_LOGS 배열에서 처음 등장하는 version: "vX.Y.Z" 를 단일 소스로 사용
  const m = src.match(/version:\s*["']v?(\d+\.\d+\.\d+)["']/);
  if (!m) {
    console.warn('[sync-version] VERSION_LOGS에서 버전을 찾지 못해 동기화를 건너뜁니다.');
    process.exit(0);
  }
  const ver = m[1];

  const pkgUrl = new URL('../package.json', import.meta.url);
  const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8'));
  if (pkg.version !== ver) {
    pkg.version = ver;
    writeFileSync(pkgUrl, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`[sync-version] package.json version → ${ver}`);
  } else {
    console.log(`[sync-version] package.json 이미 ${ver} — 동기화 불필요`);
  }
} catch (e) {
  console.warn('[sync-version] 동기화 실패(무시하고 진행):', e && e.message);
  process.exit(0); // 빌드는 절대 막지 않는다
}
