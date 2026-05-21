# 변경 이력 (CHANGELOG)

> Zero-Friction(Zero-Scheduler)의 변경 사항을 **버전별**로, 주요 항목은 **변경 전(Before) → 변경 후(After)** 형식으로 기록합니다.
> 버전 구분은 git 히스토리(커밋 19개, 2026-05-19 ~ 05-21)를 분석해 **논리적 마일스톤**으로 재구성한 것이며, 아직 git 태그는 부여하지 않았습니다.
> 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · [유의적 버전(SemVer)](https://semver.org/lang/ko/)을 따릅니다. 커밋 규칙은 [`CONTRIBUTING.md`](./CONTRIBUTING.md) 참고.

---

## 버전 개요

| 버전 | 날짜 | 핵심 요약 | 대표 커밋 |
| --- | --- | --- | --- |
| **v0.4.0** | 2026-05-21 | 메모 UX 개선 · 입력 폼 정리 · 문서 정비 | `037bb0e` `dc8f767` `17436d3` |
| **v0.3.0** | 2026-05-21 | 코드 리팩토링 · `src/` 아키텍처 통합 · 마스터 가이드 | `4441c7a` `ec31e38` `1348dcc` |
| **v0.2.0** | 2026-05-20 | 커스텀 UI 컨트롤 · 마크다운 메모 · 화면 고도화 | `ee1cb2d` `6cc0fca` `4f2e447` |
| **v0.1.0** | 2026-05-19 | 초기 구축: 앱 골격 · 백엔드 · Electron · PWA · 알림 | `827a8d5` `71b445e` `a7658df` |

---

## [v0.4.0] — 2026-05-21 · UI/UX 개선 & 문서화 *(현재/미배포)*

### ✨ 메모 상세보기 — 보기/수정 모드 분리

| 변경 전 (Before) | 변경 후 (After) |
| --- | --- |
| 메모 클릭 시 **곧바로 편집 화면**이 열림 | **읽기 전용 상세보기**로 먼저 열리고, 우측 상단 **"수정"** 버튼을 눌러야 편집 모드로 전환 |
| — | 신규 메모(+버튼)·카드의 "수정" 버튼은 기존처럼 곧바로 편집 모드 진입 |

### ♻️ 메모 리스트 카드 크기 통일

| 변경 전 (Before) | 변경 후 (After) |
| --- | --- |
| 내용 길이에 따라 카드 높이가 **제각각** | 모든 카드 **150px 고정** + 초과 내용 클리핑으로 균일한 그리드 |

### ♻️ 입력 폼 마이크로 카피·크기 정리

| 항목 | 변경 전 (Before) | 변경 후 (After) |
| --- | --- | --- |
| 일정 메모 입력창 | `rows={2}` | `rows={4}` |
| 재고 메모 입력창 | `rows={3}` | `rows={5}` |
| 재고 라벨 | "특이사항" | "메모" |
| 품목코드 플레이스홀더 | "예: CODE-01" | (제거) |
| 카테고리 옵션 라벨 | "카테고리 선택" | (제거) |
| `CustomSelect` 기본 표시 | "선택..." | (빈 값) |

### 📝 문서

* `zero_friction_fullstack_master_guide.md`의 저장 모델 서술을 **하이브리드(명시적 저장 + 자동 영속화)** 로 정정, **Cmd+F 커맨드 팔레트** 섹션·단축키 치트시트·Maintainer 표기 추가
* `CHANGELOG.md`(Before→After), `CONTRIBUTING.md`(커밋·푸시 규칙) 신규 작성
* 🗑️ `README.md` 제거 — 문서를 마스터 가이드로 일원화

---

## [v0.3.0] — 2026-05-21 · 코드 품질 & `src/` 아키텍처

### ♻️ 코드 리팩토링

대상: `ClientLayout` · `AppContext` · `SettingsSection` · `app/page.tsx`

| 구분 | 변경 전 (Before) | 변경 후 (After) |
| --- | --- | --- |
| 미사용 코드 | 죽은 함수·미사용 import/변수 잔존 (`getActivityBgColor`, `handleSaveSettings` 체인, `useRef`/`createPortal` 등) | 전부 제거 — 런타임 DOM 동일 |
| 중복 로직 | 동일 구조 4개 네비 버튼, 카테고리 색상 `switch` 3벌, 활동색 if 체인 | 데이터 기반 `map`/룩업 테이블로 통합(DRY) |
| 문서화 | JSDoc·주석 거의 없음 | 주요 컴포넌트·함수에 JSDoc + 한국어 인라인 주석 |

### 🏗️ `src/` 디렉터리 통합

| 구분 | 변경 전 (Before) | 변경 후 (After) |
| --- | --- | --- |
| 디렉터리 | 루트에 `app/ frontend/ backend/ database/ lib/ worker/` 산재 | `src/` 하위로 6개 폴더 통합, 운영 스크립트는 `scripts/`로 격리 |
| 경로 별칭 | `@/* → ./*` | `@/* → ./src/*` (import 구문은 **한 줄도 미수정**) |
| 루트 보존 | — | `public/` · `prisma/` · `main.js`는 생태계 규약상 루트 유지 |
| PWA 설정 | `customWorkerDir: "worker"` | `customWorkerDir: "src/worker"` (`dest: "public"` 유지) |

### 📝 문서

* `zero_friction_fullstack_master_guide.md` 신규 작성 (제품 비전·PWA·아키텍처·온보딩)

---

## [v0.2.0] — 2026-05-20 · 커스텀 UI 컨트롤 & 메모 고도화

### ✨ 추가 (Added)

* **커스텀 폼 컨트롤** 도입: `CustomSelect`, `CustomTimePicker`, `CustomDatePicker` — OS·브라우저 기본 위젯 대신 일관된 디자인의 드롭다운/피커
* **마크다운 메모**: `Markdown` 컴포넌트로 메모 본문 렌더링(체크리스트·강조 등)

### ♻️ 변경 (Changed)

* 캘린더·재고·설정 화면을 위 컨트롤 기반으로 재구성하고 표시 옵션(밀도·노출 개수 등) 정교화

---

## [v0.1.0] — 2026-05-19 · 초기 구축 (Foundation)

### ✨ 추가 (Added)

* **앱 골격**: Next.js 16(App Router) 기반 `Zero-Friction` 위젯 — 전체/일정(캘린더)/재고/메모/설정 단일 화면 전환
* **통합 데이터 모델**: 일정·재고·메모를 단일 `UniversalRecord`로 관리하는 `database` 모듈, 로컬 우선(LocalStorage) 영속화
* **백엔드 서비스**: 자연어 파싱(LLM: Gemini + 로컬 폴백 파서), 알림·정책·스케줄 서비스 및 `/api/*` 라우트
* **데스크톱 셸**: Electron `main.js` — 420×850 프레임리스 위젯, 알림 IPC
* **PWA**: `manifest.json`(standalone·portrait·maskable), 커스텀 서비스 워커(`worker/index.ts`)의 Web Push 수신 및 알림 클릭 시 기존 창 포커스, `useNotifications` 훅

---

## 범례

* ✨ 추가(Added) · ♻️ 변경(Changed) · 🐛 수정(Fixed) · 🗑️ 제거(Removed) · 📝 문서(Docs) · 🏗️ 아키텍처
* 날짜 형식: `YYYY-MM-DD` · 시간대: KST
* 과거 버전 구분은 커밋 메시지가 비어 있던 초기 히스토리를 변경 파일·규모로 분석해 재구성했습니다.

*Maintainer: **screening25***
