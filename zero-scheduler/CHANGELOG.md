# 변경 이력 (CHANGELOG)

> 본 문서는 Zero-Friction(Zero-Scheduler)의 주요 업데이트를 **변경 전(Before) → 변경 후(After)** 형식으로 기록합니다.
> 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르고, 커밋 규칙은 [`CONTRIBUTING.md`](./CONTRIBUTING.md)를 참고하세요.

---

## [Unreleased] — 2026-05-21

### 🧹 코드 리팩토링 (Refactoring)

대상: `ClientLayout.tsx` · `AppContext.tsx` · `SettingsSection.tsx` · `app/page.tsx`

| 구분 | 변경 전 (Before) | 변경 후 (After) |
| --- | --- | --- |
| 미사용 코드 | 미사용 import·변수·죽은 함수 잔존 (`getActivityBgColor`, `Tag`/`Workflow`, `Sun`/`Moon`/`Settings` 등, `handleSaveSettings` 체인, `useRef`/`createPortal`) | 전부 제거 — 런타임 DOM 동일 |
| 중복 로직 | 동일 구조 4개 네비 버튼, 카테고리 색상 `switch` 3벌, 활동색 if 체인 | 데이터 기반 `map`/룩업 테이블로 통합(DRY) |
| 문서화 | JSDoc·주석 거의 없음 | 주요 컴포넌트·함수에 JSDoc + 한국어 인라인 주석 추가 |
| 검증 | — | `tsc --noEmit`(strict) 통과, 런타임 `GET / 200` 확인 |

> **원칙:** 기능·스타일·DOM 계층은 100% 보존하고, "불필요한 것만" 제거했습니다.

### 🏗️ 아키텍처 (Architecture) — `src/` 통합

| 구분 | 변경 전 (Before) | 변경 후 (After) |
| --- | --- | --- |
| 디렉터리 | 루트에 `app/ frontend/ backend/ database/ lib/ worker/` 산재 | `src/` 하위로 6개 폴더 통합, 운영 스크립트는 `scripts/`로 격리 |
| 경로 별칭 | `@/* → ./*` | `@/* → ./src/*` (그 외 별칭도 `src/` 기준으로 갱신) |
| import 구문 | — | **단 한 줄도 수정하지 않음** (별칭만 갱신) |
| 루트 보존 | — | `public/` · `prisma/` · `main.js`는 생태계 규약상 루트 유지 |
| PWA 설정 | `customWorkerDir: "worker"` | `customWorkerDir: "src/worker"` (`dest: "public"` 유지) |

### ✨ UI/UX 개선

**메모 상세보기 — 보기/수정 모드 분리**

| 변경 전 (Before) | 변경 후 (After) |
| --- | --- |
| 메모를 클릭하면 **곧바로 편집 화면**이 열림 | **읽기 전용 상세보기**로 먼저 열리고, 우측 상단 **"수정"** 버튼을 눌러야 편집 모드로 전환 |
| — | 신규 메모(+버튼)·카드의 "수정" 버튼은 기존처럼 곧바로 편집 모드 진입 |

**메모 리스트 카드 크기 통일**

| 변경 전 (Before) | 변경 후 (After) |
| --- | --- |
| 내용 길이에 따라 카드 높이가 **제각각** | 모든 카드 **150px 고정** + 초과 내용 클리핑으로 균일한 그리드 |

**입력 폼 마이크로 카피·크기 정리**

| 항목 | 변경 전 (Before) | 변경 후 (After) |
| --- | --- | --- |
| 일정 메모 입력창 | `rows={2}` | `rows={4}` (확대) |
| 재고 메모 입력창 | `rows={3}` | `rows={5}` (확대) |
| 재고 라벨 | "특이사항" | "메모" |
| 품목코드 플레이스홀더 | "예: CODE-01" | (제거) |
| 카테고리 옵션 라벨 | "카테고리 선택" | (제거) |
| `CustomSelect` 기본 표시 | "선택..." | (빈 값) |
| 메모 본문 플레이스홀더 | "내용을 마크다운으로 입력하세요…" | "내용을 입력해주세요." |

### 📝 문서 (Docs)

| 구분 | 변경 전 (Before) | 변경 후 (After) |
| --- | --- | --- |
| 마스터 가이드 | 없음 | `zero_friction_fullstack_master_guide.md` 신규 작성 (제품 비전·PWA·아키텍처·온보딩) |
| 저장 모델 서술 | "저장 버튼이 없다"(부정확) | **하이브리드 모델**로 정정 — 등록/수정 모달엔 명시적 "저장" 버튼, 그 외는 자동 영속화 |
| 누락 기능 | Cmd+F 미기재 | **Cmd+F 글로벌 커맨드 팔레트** 섹션 + 단축키 치트시트 추가 |
| 메인테이너 | — | **screening25** 표기 |
| 변경 이력/기여 규칙 | 없음 | `CHANGELOG.md` · `CONTRIBUTING.md` 추가 |

---

## 범례

* ✨ 추가(Added) · ♻️ 변경(Changed) · 🐛 수정(Fixed) · 🗑️ 제거(Removed) · 📝 문서(Docs) · 🏗️ 아키텍처
* 날짜 형식: `YYYY-MM-DD` · 시간대: KST

*Maintainer: **screening25***
