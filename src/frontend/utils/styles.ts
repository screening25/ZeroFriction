// 색상·카드 스타일 관련 순수 헬퍼 모음.
// page.tsx에 인라인돼 있던 모듈 레벨 함수들을 분리 — 동작은 동일, 재사용/테스트 용이.

/** 16진수 색상(hex)을 RGB 객체로 변환한다. 실패 시 null. */
export const hexToRgb = (hex: string) => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

/** 특정 카테고리의 색상 값(단색, 소프트배경, 테두리)을 구한다. */
export const getCategoryColorStyles = (cat: string, customColors?: Record<string, string>) => {
  let solid = customColors?.[cat];
  if (!solid) {
    const staticDefaults: Record<string, string> = {
      '업무': '#007AFF',
      '회의': '#FF9500',
      '개인': '#34C759',
      '일반': '#AF52DE',
    };
    solid = staticDefaults[cat] || '#AF52DE';
  }
  const rgb = hexToRgb(solid);
  if (rgb) {
    return {
      solid,
      soft: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
      border: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`
    };
  }
  return {
    solid,
    soft: 'rgba(175, 82, 222, 0.12)',
    border: 'rgba(175, 82, 222, 0.25)'
  };
};

/**
 * 메모 카드의 색상 테마(배경색 + 테두리)를 반환한다.
 * 라이트/다크 모드별로 다른 팔레트를 사용하며, 색상 미지정 시 중립 카드 스타일을 적용한다.
 */
export const getMemoCardStyle = (color: string, isDark: boolean) => {
  const light: Record<string, { backgroundColor: string; border: string }> = {
    red:    { backgroundColor: '#FEF2F2', border: '1px solid rgba(239, 68, 68, 0.14)' },
    orange: { backgroundColor: '#FFF7ED', border: '1px solid rgba(249, 115, 22, 0.14)' },
    yellow: { backgroundColor: '#FEFCE8', border: '1px solid rgba(234, 179, 8, 0.16)' },
    green:  { backgroundColor: '#F0FDF4', border: '1px solid rgba(34, 197, 94, 0.14)' },
    blue:   { backgroundColor: '#EFF6FF', border: '1px solid rgba(59, 130, 246, 0.14)' },
    purple: { backgroundColor: '#FAF5FF', border: '1px solid rgba(168, 85, 247, 0.14)' },
  };
  const dark: Record<string, { backgroundColor: string; border: string }> = {
    red:    { backgroundColor: 'rgba(248, 113, 113, 0.10)', border: '1px solid rgba(248, 113, 113, 0.18)' },
    orange: { backgroundColor: 'rgba(251, 146, 60, 0.10)',  border: '1px solid rgba(251, 146, 60, 0.18)' },
    yellow: { backgroundColor: 'rgba(250, 204, 21, 0.10)',  border: '1px solid rgba(250, 204, 21, 0.18)' },
    green:  { backgroundColor: 'rgba(74, 222, 128, 0.10)',  border: '1px solid rgba(74, 222, 128, 0.18)' },
    blue:   { backgroundColor: 'rgba(96, 165, 250, 0.10)',  border: '1px solid rgba(96, 165, 250, 0.18)' },
    purple: { backgroundColor: 'rgba(192, 132, 252, 0.10)', border: '1px solid rgba(192, 132, 252, 0.18)' },
  };
  const palette = isDark ? dark : light;
  if (color && palette[color]) return palette[color];
  return isDark
    ? { backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)' }
    : { backgroundColor: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.06)' };
};

/**
 * 메모 모달 전용 배경 스타일.
 * getMemoCardStyle은 반투명 틴트만 반환하므로 그대로 모달 배경에 쓰면 비쳐서 가독성이 무너진다.
 * 불투명 베이스(--bg-color) 위에 색상 틴트를 합성해 항상 불투명하게 만든다.
 */
export const getMemoModalStyle = (color: string, isDark: boolean) => {
  const { backgroundColor, border } = getMemoCardStyle(color, isDark);
  return {
    background: `linear-gradient(0deg, ${backgroundColor}, ${backgroundColor}), var(--bg-color)`,
    border,
  };
};
