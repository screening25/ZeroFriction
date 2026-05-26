# Zero-Friction · 안드로이드 APK 만들기 (Capacitor 호스팅 셸)

내 폰에서 맥 없이, 평소처럼 쓰기 위한 가장 단순한 경로입니다.
앱을 **Vercel에 한 번 배포**하고, 그 주소를 감싸는 **네이티브 안드로이드 셸(.apk)**을 만들어 폰에 직접 설치합니다.

> 이미 준비된 것: `capacitor.config.ts`, `package.json`의 Capacitor 의존성/스크립트, Vercel 빌드 통과 설정(`eslint.ignoreDuringBuilds`).
> 아래 단계는 **맥에서** 진행합니다(안드로이드 빌드는 맥의 Android Studio가 필요).

---

## 0. 사전 준비 (1회)

- [Node.js](https://nodejs.org) 18+ / [Android Studio](https://developer.android.com/studio) 설치
- GitHub 계정, [Vercel](https://vercel.com) 계정(무료)

---

## 1. GitHub에 푸시

```bash
cd /Users/fitogether/Desktop/Manage
rm -f .git/index.lock .git/HEAD.lock .git/*.lock.* 2>/dev/null   # 잔여 잠금 정리
git push origin main
```

## 2. Vercel 배포

1. vercel.com → **Add New… → Project** → `screening25/ZeroFriction` Import
2. Framework는 **Next.js** 자동 인식 → **Deploy**
3. 배포 끝나면 주소가 나옵니다. 예: `https://zero-friction.vercel.app`
4. 폰 크롬에서 그 주소가 정상적으로 열리는지 먼저 확인하세요.

> 참고: AI 명령바는 Gemini를 쓰므로 **앱 설정 화면에서 본인 API 키**를 입력해야 동작합니다.
> `/api/notify`(맥 osascript)는 서버(리눅스)에서 동작하지 않지만, 폰에서는 **인앱 알림 카드**가 대신하므로 문제 없습니다.

## 3. capacitor.config.ts 주소 교체

`capacitor.config.ts`의 `server.url` 을 **2번에서 받은 실제 주소**로 바꿉니다.

```ts
server: {
  url: 'https://zero-friction.vercel.app', // ← 본인 주소
  cleartext: false,
},
```

## 4. Capacitor 안드로이드 프로젝트 생성

```bash
npm install                 # capacitor 의존성 설치
npx cap add android         # android/ 네이티브 프로젝트 생성 (최초 1회)
npm run cap:sync            # 설정/웹 자산 동기화
npm run cap:open            # Android Studio 열기
```

## 5. Android Studio에서 APK 빌드

1. Gradle 동기화가 끝나길 기다립니다.
2. 상단 메뉴 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. 완료 알림의 **locate** 클릭 → `android/app/build/outputs/apk/debug/app-debug.apk`

## 6. 폰에 설치 (사이드로드)

1. `app-debug.apk` 를 카카오톡/구글 드라이브/이메일로 폰에 전송
2. 폰에서 다운로드 후 실행 → "**출처를 알 수 없는 앱 설치**" 권한 허용
3. 설치 완료 → 홈 화면 아이콘으로 실행

---

## 업데이트할 때

코드를 고치면 **Vercel이 자동 재배포**되므로, 폰 앱은 다음 실행 때 최신 화면을 그대로 받습니다.
(네이티브 셸/아이콘/앱 이름 등 셸 자체를 바꿀 때만 APK를 다시 빌드하면 됩니다.)

## 참고 / 한계

- 이 방식은 화면을 Vercel에서 불러오므로 **실행 시 인터넷이 필요**합니다(앱 데이터 자체는 폰 localStorage에 저장).
- 앱이 닫힌 상태의 정시 푸시 알림이 필요하면 추후 **Web Push(VAPID)** 또는 **Capacitor 로컬 알림**을 추가하면 됩니다. 앱이 열려 있을 때의 알림은 지금도 동작합니다.
- 정식 배포(Play 스토어)로 가려면 `app-release.apk`(서명 키 필요) 또는 AAB를 만들면 됩니다.

*Maintainer: screening25*
