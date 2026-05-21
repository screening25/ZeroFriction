# 기여 가이드 (CONTRIBUTING)

Zero-Friction(Zero-Scheduler) 저장소의 **커밋 메시지 규칙**과 **브랜치·푸시 규칙**을 정의합니다.
일관된 히스토리는 변경 추적·롤백·리뷰 비용을 줄이는 가장 값싼 투자입니다.

---

## 1. 커밋 메시지 규칙 (Conventional Commits)

### 1.1 형식

```
<type>(<scope>): <subject>

<body>          # 선택: 변경 이유(Why)와 맥락. 한 줄당 72자 내외
<footer>        # 선택: BREAKING CHANGE, 이슈 참조 (예: Closes #12)
```

* **제목(subject)** 은 한국어 **명령형**으로, **50자 이내**, 끝에 **마침표 없음**.
* 제목은 "무엇을 했는가"를, 본문은 "왜 했는가"를 적습니다.
* 하나의 커밋은 **하나의 논리적 변경**만 담습니다.

### 1.2 type 목록

| type | 용도 |
| --- | --- |
| `feat` | 사용자에게 보이는 새 기능 |
| `fix` | 버그 수정 |
| `refactor` | 동작 변화 없는 구조 개선 (기능·UI 보존) |
| `style` | 포매팅·세미콜론 등 비기능적 변경 |
| `docs` | 문서만 변경 |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `build` | 빌드 시스템·의존성 (`package.json` 등) |
| `ci` | CI 설정 |
| `chore` | 그 외 잡무 (릴리스, 설정 파일 등) |

### 1.3 scope 예시

`memo` · `calendar` · `inventory` · `settings` · `pwa` · `notify` · `arch` · `ui` · `db`
(해당 변경이 닿는 도메인/모듈. 광범위하면 생략 가능)

### 1.4 예시

```text
feat(memo): 메모 상세보기를 읽기 전용으로 분리하고 수정 버튼 추가

클릭 즉시 편집되던 동작을 보기/수정 2단계로 나눠 실수 편집을 방지한다.
신규 메모와 '수정' 버튼은 기존처럼 곧바로 편집 모드로 진입한다.

refactor(arch): 소스 폴더를 src/ 하위로 통합하고 경로 별칭 갱신
docs: 마스터 가이드의 저장 모델 서술 정정 및 Cmd+F 섹션 추가
fix(inventory): 재고 메모 라벨 '특이사항'을 '메모'로 변경
chore(release): v0.2.0 변경 이력 정리
```

---

## 2. 브랜치 규칙

| 브랜치 | 역할 |
| --- | --- |
| `main` | 항상 **배포 가능(deployable)** 상태 유지 |
| `feat/<설명>` | 기능 개발 (예: `feat/memo-readonly-view`) |
| `fix/<설명>` | 버그 수정 (예: `fix/inventory-label`) |
| `refactor/<설명>` | 구조 개선 |
| `docs/<설명>` | 문서 작업 |

* 브랜치명은 **소문자·하이픈(kebab-case)** 으로 작성합니다.

---

## 3. 푸시 / PR 규칙

### 3.1 푸시 전 체크리스트

```bash
npx tsc --noEmit     # ① 타입 오류 0
npm run lint         # ② 린트 통과
npm run build        # ③ 프로덕션 빌드 성공 (배포 전 필수)
```

위 3가지가 모두 통과한 뒤에만 푸시합니다.

### 3.2 표준 작업 흐름

```bash
git switch -c feat/<설명>          # 작업 브랜치 생성
git add -A                         # 변경 스테이징 (이름 변경도 자동 인식)
git commit -m "feat(scope): ..."   # 규칙에 맞춘 커밋
git push -u origin feat/<설명>      # 원격 푸시 후 PR 생성
```

* **PR 제목**도 커밋 규칙(`type(scope): subject`)을 따릅니다.
* PR 본문에는 변경 요약 + 검증 결과(타입체크/빌드)를 적습니다.
* 리뷰 승인 후 `main`에 머지합니다.

### 3.3 메인테이너 직접 푸시 (예외)

솔로 유지보수(maintainer: **screening25**) 상황의 소규모/긴급 변경에 한해 `main` 직접 푸시를 허용합니다.

```bash
git add -A
git commit -m "type(scope): subject"
git push origin main
```

> ⚠️ 직접 푸시 시에도 §3.1 체크리스트는 반드시 선행합니다.

---

## 4. 참고

* 변경 이력은 [`CHANGELOG.md`](./CHANGELOG.md)에 **Before → After** 형식으로 누적합니다.
* 원격: `https://github.com/screening25/ZeroFriction.git`

*Maintainer: **screening25***
