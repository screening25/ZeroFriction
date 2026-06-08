/**
 * 문자열이 기기 일련번호(시리얼/바코드) 패턴인지 판별한다.
 * 재고 일괄 등록 시 품목코드와 개별 기기 시리얼을 자동 분리하는 데 사용.
 */
export const isSerialPattern = (val: string): boolean => {
  const cleanVal = val.trim();
  if (!cleanVal) return false;

  // 패턴 1: 하이픈/언더스코어로 구분된 영숫자 3토막 이상, 끝이 숫자거나 영문+숫자 혼합
  const parts = cleanVal.split(/[-_]/);
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    const isNumericLast = /^\d+$/.test(lastPart);
    const hasLettersAndDigits = /[a-zA-Z]/.test(cleanVal) && /\d/.test(cleanVal);
    if (isNumericLast || hasLettersAndDigits) {
      return true;
    }
  }

  // 패턴 2: 영숫자 + 하이픈/언더스코어 + 끝자리 숫자 형태의 전형적 바코드/시리얼
  if (/^[A-Z0-9]+[-_][0-9]+$/i.test(cleanVal)) {
    return true;
  }

  return false;
};
