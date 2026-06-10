// VAPID 공개키 — 클라이언트 구독에 사용(공개값이라 코드/공개레포에 둬도 안전).
// 비밀키는 절대 코드에 두지 않고 Vercel 환경변수 VAPID_PRIVATE_KEY 로만 설정한다.
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BMZhZVv2SzLrqoJbCtiqydwmQaBBysYcQ5deDJpQWWktVbEOl25u63MRACdu9R-V2hR-0KAM9V2Co9WzahhDO6Q';
