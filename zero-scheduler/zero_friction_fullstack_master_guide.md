# Zero-Friction (Zero-Scheduler) · 풀스택 엔지니어링 마스터 가이드

> 본 문서는 세 가지 목적을 동시에 수행합니다.
> **① 풀스택 엔지니어링 포트폴리오** — 무엇을, 왜, 어떻게 설계했는가.
> **② 내부 피치(Pitch) 자료** — 제품 철학과 기술적 차별점.
> **③ 팀 온보딩 가이드** — 신규 합류자가 5분 안에 로컬 환경을 구동하는 실행 매뉴얼.

| 항목 | 내용 |
| --- | --- |
| 제품명 | **Zero-Friction** (코드네임: Zero-Scheduler) |
| 분류 | B2B SaaS 상주형 마이크로 대시보드 위젯 |
| 핵심 스택 | Next.js 16 (App Router · Turbopack) · React · TypeScript 5 |
| 데스크톱 | Electron 42 (프레임리스 위젯 셸) |
| 모바일/웹 | PWA (@ducanh2912/next-pwa 10 · Workbox) |
| 데이터 | Prisma 7 (`@prisma/adapter-pg`) · PostgreSQL · 로컬 우선(LocalStorage) |
| AI 연동 | Google Gemini (자연어 파싱) + 로컬 폴백 파서 |
| 아키텍처 | 통합 `src/` 디렉터리 · 경로 별칭(`@/*`) 기반 |

---

## 목차

1. [제품 비전과 트리거 — "마찰 제로" 철학](#1-제품-비전과-트리거--마찰-제로-철학)
2. [풀스택 & PWA 심층 분석](#2-풀스택--pwa-심층-분석)
3. [아키텍처 리스트럭처링 — `src/` 통합](#3-아키텍처-리스트럭처링--src-통합)
4. [온보딩 & 로컬 셋업 프로토콜](#4-온보딩--로컬-셋업-프로토콜)
5. [부록 — 기술 스택 & 명령어 치트시트](#5-부록--기술-스택--명령어-치트시트)

---

## 1. 제품 비전과 트리거 — "마찰 제로" 철학

### 1.1 문제 정의 — 도구가 만들어내는 마찰(Friction)

현대의 협업 도구(Notion, Jira 등)는 강력하지만, **일상적인 운영 업무에는 과도하게 무겁습니다.** 간단한 일정 하나, 재고 한 건을 기록하기 위해 다음과 같은 비용을 치릅니다.

> **컨텍스트 스위칭 비용 (Context-Switching Cost)**
> 작업 흐름을 멈추고 → 별도 앱/탭으로 전환 → 무거운 워크스페이스 로딩 대기 → 여러 단계의 클릭. 이 전환 과정 자체가 집중을 깨뜨립니다.

> **인지 과부하 (Cognitive Overload)**
> 화면을 가득 채운 사이드바, 중첩 메뉴, 장황한 마이크로카피, 가변적인 레이아웃은 "기록"이라는 단순 행위에 불필요한 사고 부하를 더합니다.

핵심 문제는 기능 부족이 아니라 **마찰**입니다. 도구가 사용자의 사고 속도를 따라오지 못할 때, 사용자는 기록을 포기합니다.

### 1.2 해법 — "Zero-Friction" 마이크로 대시보드

Zero-Friction은 "기록과 확인 사이의 모든 마찰을 0으로 수렴시킨다"는 단일 원칙 위에 설계되었습니다.

| 설계 원칙 | 무엇을 했는가 (What) | 왜 했는가 (Why) |
| --- | --- | --- |
| **상주형 위젯** | 화면 한쪽에 고정 상주하는 420×850 프레임리스 셸 (Electron) | 전환 없이 시야에 머무름 → 컨텍스트 스위칭 비용 제거 |
| **마이크로카피 군더더기 제거** | `24시간제 → 24시간`, 군더더기 라벨 축약, 자연어 단일 입력창 | 읽는 데 드는 시간을 줄여 인지 부하 최소화 |
| **픽셀 단위 사이즈 락** | `setAspectRatio(420/850)`로 종횡비 고정, 레이아웃 시프트 차단 | 위치·크기가 흔들리지 않아야 "안심하고 무시할 수 있는" 위젯이 됨 |
| **자연어 우선 입력** | "내일 오후 3시 디자인 리뷰" 한 줄 → AI가 분류·등록 | 폼(form)을 채우는 마찰을 언어로 대체 |

> **디자인 신념:** 좋은 위젯은 *주목받지 않을 때* 가장 큰 가치를 낸다. 흔들리지 않고(no layout shift), 군더더기 없이(no filler), 항상 거기 있을 것(always-on).

---

## 2. 풀스택 & PWA 심층 분석

### 2.1 크로스플랫폼 PWA — 하나의 코드베이스, 모든 생태계

단일 Next.js 코드베이스로 **Galaxy(Android)** 와 **Apple(iOS / macOS)** 생태계를 모두 네이티브에 가깝게 타게팅합니다. 핵심은 `@ducanh2912/next-pwa`(Workbox 기반)와 PWA 매니페스트입니다.

```jsonc
// public/manifest.json
{
  "name": "Zero-Friction",
  "short_name": "ZF Widget",
  "display": "standalone",   // 브라우저 크롬 제거 → 네이티브 앱 경험
  "orientation": "portrait",  // 위젯 형태에 맞춘 세로 고정
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "purpose": "any maskable" }
  ]
}
```

> **Why `maskable`:** Galaxy/Android의 적응형 아이콘 마스크와 iOS 홈 화면 양쪽에서 잘리지 않고 일관된 아이콘을 보장하기 위함입니다.

**런타임 캐싱 전략 (Workbox)** — `next-pwa`의 Workbox 런타임 캐싱을 활용해 자원 성격별로 전략을 분리합니다.

| 자원 유형 | 전략 | 왜 (Why) |
| --- | --- | --- |
| 정적 UI 자산(JS·CSS·폰트·이미지) | **Stale-While-Revalidate** | 캐시본을 즉시 표시해 체감 로딩을 0에 가깝게, 동시에 백그라운드에서 최신본 갱신 |
| 페이지/데이터 요청 | **Network-First** | 항상 최신 데이터를 우선하되, 오프라인 시 캐시로 우아하게 폴백 |
| 푸시·백그라운드 동기화 | **Service Worker** | 앱이 포그라운드가 아닐 때도 알림 수신·처리 가능 |

```ts
// next.config.ts — PWA 설정
const withPWA = withPWAInit({
  dest: "public",                                  // SW 산출물은 루트 public/ (Next.js 규약)
  disable: process.env.NODE_ENV === "development", // 개발 중 SW 비활성화로 HMR 방해 방지
  customWorkerDir: "src/worker",                   // 커스텀 SW 소스 (src 통합 반영)
});
```

> **엔지니어링 결정:** 개발 모드에서는 SW를 끄고(`disable`), 프로덕션 빌드에서만 활성화합니다. 개발 중 캐시가 HMR/디버깅을 방해하는 고전적 함정을 회피합니다.

### 2.2 Web Push 백엔드 엔진

푸시 알림은 **커스텀 서비스 워커**(`src/worker/index.ts`)와 **백엔드 알림 라우트**(`/api/notify`), 그리고 데스크톱의 **Electron IPC**가 협력하는 멀티 채널 구조입니다.

```ts
// src/worker/index.ts — 푸시 수신
self.addEventListener("push", (event) => {
  const data = event.data.json();
  const options = {
    body: data.body || "새로운 알림이 도착했습니다.",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(data.title || "Zero-Friction", options));
});
```

**알림 클릭 처리 — 중복 탭을 만들지 않는다.** 단순히 새 창을 여는 대신, 이미 열려 있는 창을 탐색해 **포커스를 우선** 부여합니다.

```ts
// src/worker/index.ts — 알림 클릭
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const targetUrl = event.notification.data?.url || "/";
      // ① 동일 URL의 기존 창이 있으면 포커스 (불필요한 탭 양산 방지)
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      // ② 없을 때만 새 창 오픈
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
```

> **Why focus-first:** 사용자가 알림을 누를 때마다 새 탭이 쌓이면 그 자체가 마찰입니다. "기존 창 포커스 → 없을 때만 새 창" 순서는 OS 네이티브 앱의 단일 인스턴스 동작을 모사하여 일관된 경험을 제공합니다.

**채널 분기** — 환경에 따라 최적 채널을 자동 선택합니다.

| 실행 환경 | 알림 채널 | 동작 |
| --- | --- | --- |
| Electron 데스크톱 | `ipcRenderer.send('send-notification')` | OS 네이티브 `Notification` 표시 |
| 브라우저(권한 허용) | Web `Notification` API | 즉시 로컬 알림 |
| 그 외 / 폴백 | `POST /api/notify` | 백엔드 경유 발송 |

### 2.3 JSON 상태 머신 기반 브리핑 위젯

대시보드 상단의 **스마트 데일리 브리핑**은 하드코딩된 문구가 아니라, 로컬 시각과 데이터 상태에 반응하는 **상태 머신(state machine)** 입니다.

**① 시간대 인지 인사말** — `new Date().getHours()` 기준으로 마이크로카피가 동적으로 바뀝니다.

| 시간대 | 인사말 |
| --- | --- |
| 05–09시 | "오늘도 힘차게 시작하는 좋은 아침입니다!" |
| 09–12시 | "업무에 집중하기 좋은 오전 시간입니다." |
| 12–13시 | "맛있는 식사와 함께 편안한 점심시간 보내세요." |
| 13–18시 | "오늘 오후도 활기차게 보내시길 바랍니다." |
| 18–22시 | "오늘 하루도 수고 많으셨습니다. 편안한 저녁 보내세요." |
| 그 외(심야) | "오늘 하루도 고생하셨습니다. 평안한 밤 되시길 바랍니다." |

**② 4단계 상태(statusLevel)** — 데이터 조합에 따라 `warning / done / busy / calm` 중 하나로 수렴합니다.

```ts
// src/app/page.tsx — 브리핑 상태 결정 로직(요지)
if (lowStockItemsCount > 0) {
  statusLevel = 'warning';   // 재고 부족 — 즉각적 주의 환기 (앰버)
} else if (totalTodaySchedules > 0 && remainingTodaySchedules === 0) {
  statusLevel = 'done';      // 🎉 All Done — 등록된 일정을 모두 완료
} else if (remainingTodaySchedules > 0) {
  statusLevel = 'busy';      // 남은 일정 존재 (블루)
} else {
  statusLevel = 'calm';      // 비어 있는 평온 상태
}
```

> **핵심 차별점 — 'All Done' ≠ 'Empty':** 일정이 *처음부터 없었던* `calm`(비어 있음)과, 일정을 *모두 완료해 비워낸* `done`을 명확히 구분합니다. `done` 상태는 "금일 등록된 일정이 모두 완료되었습니다"라는 **보상적 피드백**을 제공해 완료의 성취감을 강화합니다. 동일한 '0개'라도 사용자의 맥락은 정반대이기 때문입니다.

### 2.4 Notion 스타일 미니멀 메모 에디터

메모 작성 경험은 전통적인 폼을 버리고 **단일 컬럼 풀블리드(full-bleed)** 에디터로 리팩토링했습니다.

| 요소 | 구현 | 왜 (Why) |
| --- | --- | --- |
| 투명·보더리스 입력 | 제목/본문 input의 테두리·배경 제거 | 입력 UI가 콘텐츠를 가리지 않도록 — "종이에 쓰는" 느낌 |
| 단일 컬럼 풀블리드 | 좌우 여백 최소화, 본문 폭 최대 활용 | 시선 이동 최소화로 작성 몰입 |
| 파스텔 배경 라이브 프리뷰 | 색상 선택 시 카드 배경이 즉시 미리보기로 변경 | 저장 전에 결과를 보여줘 의사결정 마찰 제거 |

```ts
// src/app/page.tsx — getMemoCardStyle(): 라이트/다크별 파스텔 팔레트
//  라이트: 파스텔-50 톤(#FEF2F2 등) / 다크: 저채도 muted 톤(rgba(...,0.10))
//  6색(red·orange·yellow·green·blue·purple) + 무색 중립 카드 폴백
```

> **엔지니어링 결정:** 색상은 라이트/다크 모드별로 별도 팔레트를 운영합니다. 라이트의 파스텔이 다크에서 과채도로 튀는 문제를 막고, 두 테마 모두에서 가독성과 톤 일관성을 유지합니다.

---

## 3. 아키텍처 리스트럭처링 — `src/` 통합

### 3.1 구조 진화 (Before ➡️ After)

루트에 평평하게 흩어져 있던 6개 소스 폴더를 단일 `src/` 계층으로 통합하고, 운영 스크립트는 `scripts/`로 격리했습니다. 생태계 규약 폴더는 루트에 그대로 보존했습니다.

```text
Before (흩어진 루트)                 After (통합된 src/)
zero-scheduler/                      zero-scheduler/
├── app/            ─┐               ├── src/
├── frontend/        │  소스 6종      │   ├── app/        # Next.js App Router
├── backend/         │  루트에         │   ├── frontend/   # UI(components·context·hooks)
├── database/        │  산재          │   ├── backend/    # services(llm·notify·policy·schedule)
├── lib/             │      ───►      │   ├── database/   # 데이터 모듈
├── worker/         ─┘               │   ├── lib/        # prisma client 등 공용
├── query_db.ts                      │   └── worker/     # PWA 커스텀 SW
├── list-models.mjs                  ├── scripts/        # query_db.ts · list-models.mjs
├── public/  prisma/  main.js        ├── public/  prisma/  main.js   # 🔒 루트 보존
└── (config files)                   └── (config files)
```

### 3.2 무중단 마이그레이션 메커니즘 (Non-Breaking Migration)

> **단 한 줄의 `import` 문도 수정하지 않았습니다.** 비밀은 `tsconfig.json`의 경로 별칭에 있습니다.

코드 전반은 상대 경로가 아닌 `@/` 별칭으로 모듈을 참조합니다(`@/frontend/...`, `@/database`, `@/backend/...`). 폴더를 옮긴 뒤 **별칭의 매핑 대상만** `./*` → `./src/*`로 갱신하면, 컴포넌트 코드는 변경 없이 그대로 동작합니다.

```jsonc
// tsconfig.json — paths (매핑 대상만 src/ 기준으로 갱신)
"paths": {
  "@/*":          ["./src/*"],
  "@/app/*":      ["./src/app/*"],
  "@/frontend/*": ["./src/frontend/*"],
  "@/backend/*":  ["./src/backend/*"],
  "@/database":   ["./src/database"],
  "@/database/*": ["./src/database/*"],
  "@/lib/*":      ["./src/lib/*"]
}
// include 글롭도 "app/**" → "src/app/**" 등으로 동일하게 갱신
```

| 검증 계층 | 방법 | 결과 |
| --- | --- | --- |
| 정적 타입 | `npx tsc --noEmit` (strict) | ✅ exit 0 — 전 `@/` import 정상 해석 |
| 런타임 | 라이브 dev 서버 자동 재시작 후 요청 | ✅ `GET / 200` — `src/app`에서 정상 서빙 |

> **Why 별칭 우선 설계:** 처음부터 절대 경로 별칭으로 일관 참조했기에, 디렉터리 구조 변경이 "설정 한 곳"의 문제로 국소화됩니다. 이것이 대규모 리팩토링을 **무중단**으로 만드는 핵심 레버리지입니다.

### 3.3 루트 보존 원칙 — 왜 옮기지 않았는가

모든 것을 `src/`로 옮기지 않았습니다. 생태계 규약과 상대 경로 바인딩에 묶인 항목은 **의도적으로 루트에 고정**했습니다.

| 보존 항목 | 루트 유지 사유 (Why) |
| --- | --- |
| `public/` | Next.js는 정적 자산을 **루트 `public/`만** 인식. PWA(`dest: "public"`)의 SW 산출 위치이기도 함 |
| `prisma/` · `prisma.config.ts` | Prisma 표준 스키마 경로 규약(`prisma/schema.prisma`)에 바인딩 |
| `main.js` (Electron 엔트리) | `npx electron main.js`로 직접 실행되며, 내부에서 `path.join(__dirname, 'public', ...)`로 루트 상대 경로 사용 → 이동 시 아이콘/실행 경로 동시 파손 |
| 설정 파일군 | `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs` 등 툴체인이 루트 기준 탐색 |

---

## 4. 온보딩 & 로컬 셋업 프로토콜

### 4.1 사전 요구사항

| 도구 | 권장 버전 |
| --- | --- |
| Node.js | 18 LTS 이상 (20+ 권장) |
| 패키지 매니저 | npm |
| 데이터베이스 | PostgreSQL (로컬은 `docker-compose` 사용) |
| 데스크톱 실행(선택) | Electron 42 |

### 4.2 설치 & 실행

```bash
# 1) 의존성 설치
npm install

# 2) 환경 변수 — .env 에 DATABASE_URL 등 설정
#    (예: DATABASE_URL="postgresql://user:pass@localhost:5432/zero")

# 3) (선택) 로컬 Postgres 기동 — 저장소 루트의 docker-compose 사용
docker-compose up -d

# 4) Prisma 클라이언트 생성
npx prisma generate

# 5) 개발 서버 (포트 3005)
npm run dev
```

데스크톱 위젯(Electron)으로 함께 띄우려면 dev 서버 가동 후:

```bash
npx electron main.js   # localhost:3005 를 420×850 프레임리스 창으로 로드
```

### 4.3 포트 충돌 & 외부 네트워크 노출

> **포트 3005가 이미 점유된 경우** — 잔여 프로세스를 정리하고 재기동합니다.

```bash
npx kill-port 3005      # 3005 점유 프로세스 종료
# 또는: lsof -ti:3005 | xargs kill -9
npm run dev
```

> **실기기(모바일)에서 접속하려면** — dev 서버를 모든 인터페이스에 바인딩합니다.

```bash
# -H 0.0.0.0 : localhost뿐 아니라 LAN IP로도 수신 → 같은 Wi-Fi의 휴대폰에서 접속 가능
next dev -p 3005 -H 0.0.0.0
# 휴대폰 브라우저에서 → http://<개발PC_LAN_IP>:3005  (예: http://192.168.0.214:3005)
```

### 4.4 모바일 실기기 HMR — `allowedDevOrigins` 구성

실기기(예: Galaxy S25)에서 접속하면 출처(origin)가 `localhost`가 아닌 LAN IP가 됩니다. Next.js 16은 보안상 **크로스 오리진 dev 요청(HMR/웹팩 청크)** 을 기본 차단하므로, 허용 목록을 명시해야 모바일에서 HMR이 끊기지 않습니다.

```ts
// next.config.ts
const nextConfig: NextConfig = {
  devIndicators: false,                    // Electron 위젯 모드에서 dev 인디케이터 숨김
  allowedDevOrigins: [                     // 모바일 실기기 HMR 언블록
    'localhost:3005',
    '192.168.0.214:3005',
    '192.168.0.214',
  ],
  // @ts-ignore
  turbopack: {},
};
```

> **Why:** 이 설정이 없으면 휴대폰에서 첫 페이지는 떠도 코드 수정 시 HMR 청크 요청이 CORS로 막혀 "변경이 반영되지 않는" 현상이 발생합니다. `allowedDevOrigins`에 LAN IP를 등록해 실기기 핫 리로드를 정상화했습니다. (배포 시점에는 개발 전용 설정이므로 영향 없음)

### 4.5 디렉터리 레퍼런스

| 경로 | 역할 |
| --- | --- |
| `src/app/` | App Router — 페이지, 레이아웃, `api/` 라우트, `globals.css` |
| `src/frontend/` | UI 레이어 — `components/`, `context/`(AppContext), `hooks/` |
| `src/backend/services/` | 서버 서비스 — `llm/`(Gemini·파서·프롬프트), `notify`·`policy`·`schedule` |
| `src/database/` | 도메인 데이터 모듈 (`UniversalRecord` 등) |
| `src/lib/` | 공용 유틸 (`prisma.ts` 클라이언트) |
| `src/worker/` | PWA 커스텀 서비스 워커(푸시·알림 클릭) |
| `scripts/` | 운영 스크립트 (`query_db.ts`, `list-models.mjs`) |
| `public/` · `prisma/` · `main.js` | 🔒 루트 보존 (생태계 규약) |

---

## 5. 부록 — 기술 스택 & 명령어 치트시트

### 5.1 기술 스택 요약

| 레이어 | 기술 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js 16 (App Router, Turbopack) | `src/app` 자동 인식 |
| 언어 | TypeScript 5 (`strict`) | 경로 별칭 `@/*` |
| UI | React · framer-motion · lucide-react | 애니메이션·아이콘 |
| 날짜 | date-fns | 캘린더/상대시간 |
| 데스크톱 | Electron 42 · electron-builder 26 | 프레임리스 위젯 셸 |
| PWA | @ducanh2912/next-pwa 10 · Workbox | SWR / Network-First |
| DB/ORM | PostgreSQL · Prisma 7 · @prisma/adapter-pg | 드라이버 어댑터 |
| AI | Google Gemini + 로컬 폴백 파서 | 자연어 → 구조화 |

### 5.2 명령어 치트시트

| 목적 | 명령 |
| --- | --- |
| 개발 서버 | `npm run dev` (`next dev -p 3005`) |
| 모바일 노출 | `next dev -p 3005 -H 0.0.0.0` |
| 포트 정리 | `npx kill-port 3005` |
| 프로덕션 빌드 | `npm run build` |
| 타입 체크 | `npx tsc --noEmit` |
| 린트 | `npm run lint` |
| Prisma 생성 | `npx prisma generate` |
| Electron 실행 | `npx electron main.js` |

---

> **Zero-Friction 엔지니어링 원칙 요약**
> ① 마찰을 0으로 — 상주·축약·고정. ② 하나의 코드베이스로 모든 생태계 — PWA + Electron.
> ③ 맥락을 이해하는 UI — 상태 머신 브리핑. ④ 무중단 진화 — 별칭 기반 아키텍처.

*문서 작성일: 2026-05-21 · Zero-Friction (Zero-Scheduler) Engineering Master Guide*
