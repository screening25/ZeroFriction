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

// 모델명(품목코드) 패턴 — 예: FTG13-0005, ELC17-0014, ASS11-0003 (영문 2~5 + 숫자 + '-' + 숫자)
const MODEL_CODE_RE = /^[A-Za-z]{2,5}\d{1,3}-\d{2,6}$/;
// 사이즈 토큰 — 의류/장비 규격
const SIZE_RE = /^(XS|S|M|L|XL|XXL|XXXL|2XL|3XL|FREE)$/i;

/**
 * 카메라 OCR로 얻은 단어 한 개가 무엇인지 패턴으로 자동 판별한다.
 * - 'code'   : 모델명(품목코드) 형태   (FTG13-0005)
 * - 'serial' : 시리얼/바코드 형태      (CLBX-5E-34107, LHP1-1A-00696)
 * - 'title'  : 사이즈 규격            (S, M, XL …)
 * - null     : 판별 불가(사용자가 직접 선택)
 * 모델코드가 시리얼 패턴도 만족하므로 모델코드를 먼저 검사한다.
 */
export const classifyToken = (raw: string): 'code' | 'title' | 'serial' | null => {
  const v = raw.trim();
  if (!v) return null;
  if (MODEL_CODE_RE.test(v)) return 'code';
  if (isSerialPattern(v)) return 'serial';
  if (SIZE_RE.test(v)) return 'title';
  return null;
};

/**
 * 인식된 단어 목록을 모델명/품목명/시리얼로 자동 배치한다(각 항목당 가장 먼저 매칭된 토큰).
 * 자신 있게 분류되는 코드·시리얼·사이즈만 채우고, 나머지는 사용자가 태그를 탭해 보완한다.
 */
export const autoClassifyTokens = (tokens: string[]): { code?: string; title?: string; serial?: string } => {
  const out: { code?: string; title?: string; serial?: string } = {};
  for (const t of tokens) {
    const kind = classifyToken(t);
    if (kind && !out[kind]) out[kind] = t.trim();
  }
  return out;
};

/** 재고 일괄 등록(붙여넣기 파싱) 행 데이터 */
export interface BulkRow {
  code: string;
  title: string;
  qty: number;
  flow: 'IN' | 'OUT';
  loc: string;
  mgr: string;
  memo: string;
  serial?: string;
}

/** 일괄 등록 행 병합: 시리얼 없는 동일 품목명 행을 합치고 입·출고 수량을 상계한다. */
export const mergeBulkRows = (rows: BulkRow[], locations: string[], managers: string[]): BulkRow[] => {
  const mergedList: BulkRow[] = [];
  rows.forEach(row => {
    // If the row has a serial number, keep it as a distinct entry.
    if (row.serial) {
      mergedList.push({ ...row });
      return;
    }

    // Find an existing row with the same title that does not have a serial number.
    const existing = mergedList.find(r => r.title.trim() === row.title.trim() && !r.serial);
    if (!existing) {
      mergedList.push({ ...row });
    } else {
      const existingNet = existing.flow === 'IN' ? existing.qty : -existing.qty;
      const currentNet = row.flow === 'IN' ? row.qty : -row.qty;
      const totalNet = existingNet + currentNet;

      existing.qty = Math.abs(totalNet);
      existing.flow = totalNet >= 0 ? 'IN' : 'OUT';

      if (!existing.code && row.code) {
        existing.code = row.code.trim();
      }
      if (row.loc && row.loc !== locations[0]) {
        existing.loc = row.loc.trim();
      }
      if (row.mgr && row.mgr !== managers[0]) {
        existing.mgr = row.mgr.trim();
      }
      const memos = [existing.memo, row.memo].map(m => m.trim()).filter(Boolean);
      existing.memo = memos.join('; ');
    }
  });
  return mergedList;
};

/** 클립보드 TSV/CSV/마크다운 표 텍스트를 BulkRow 목록으로 파싱한다. */
export const parseBulkPasteText = (text: string, locations: string[], managers: string[]): BulkRow[] => {
  const lines = text.split(/\r?\n/);
  const parsed: BulkRow[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Skip Markdown separator lines like | --- | --- |
    if (/^[|\s\-:]+$/.test(trimmed)) {
      return;
    }

    let cols: string[] = [];
    if (trimmed.includes('|')) {
      // Parse as Markdown table row
      cols = trimmed.split('|').map(s => s.trim());
      // Remove empty first/last elements if it had leading/trailing pipes
      if (cols.length > 0 && cols[0] === '') cols.shift();
      if (cols.length > 0 && cols[cols.length - 1] === '') cols.pop();
    } else {
      // Parse as standard TSV / CSV
      cols = trimmed.split(/\t|,/).map(s => s.trim());
    }

    if (cols.length === 0) return;

    // Skip header row or total lines
    const rawFirst = (cols[0] || '').replace(/\*/g, '').trim();
    const firstColLower = rawFirst.toLowerCase().replace(/\s+/g, '');
    
    const isHeaderOrTotal = 
      !rawFirst ||
      [
        '코드', 'code', '품목코드', '구분', '품명', '품목명', '수량',
        '기기번호', '기기번호', '시리얼', '시리얼번호', '일련번호', '일련번호', 'serial', 'serialnumber', 'serialno',
        's/n', 'sn', '기기명', '모델', '모델명', 'model', 'modelname', '기기', '번호', '비고', '상태'
      ].includes(firstColLower) ||
      firstColLower.includes('total') ||
      firstColLower.includes('합계') ||
      firstColLower.includes('grand');

    if (isHeaderOrTotal) {
      return;
    }

    let code = cols[0] || '';
    let title = cols[1] || '';
    let serial = '';
    let memo = cols[6] || '';
    
    const isSerial = isSerialPattern(code);
    if (isSerial) {
      serial = code.trim();
      const parts = serial.split(/[-_]/);
      const prefix = parts.slice(0, parts.length - 1).join('-');
      code = prefix;

      const secColClean = (cols[1] || '').trim();
      const secColLower = secColClean.toLowerCase().replace(/\s+/g, '');
      const isStatusOrInfo = 
        !secColClean ||
        [
          '보유', '출고', '입고', '사용중', '폐기', '수리중', '대여중', '정상', '고장', '불량', '미개봉',
          'in', 'out', 'active', 'inactive', 'lost', 'broken', 'damaged', 'stored', 'available', 'status',
          '동고fc', '안산fc', '충원고등학교', '경기모션fc', 'leofc', '동명대학교', '전북현대u18', '보물섬남해u15', '비즈니스팀', 'champasakavenir', '보물섬남해u15', '보물섬남해u18', '동고fc',
          '비고'
        ].includes(secColLower) ||
        secColClean.includes('데모') ||
        secColClean.includes('입고') ||
        secColClean.includes('출고');

      if (isStatusOrInfo) {
        title = prefix;
        // Combine second column status with third column comments (if any)
        const extraInfo = cols[2] ? cols[2].trim() : '';
        const statusMemo = secColClean + (extraInfo ? ` (${extraInfo})` : '');
        memo = memo ? `${statusMemo}; ${memo}` : statusMemo;
      } else {
        title = secColClean;
      }
    }

    const qtyStr = cols[2] || '1';
    const qty = isSerial ? 1 : (parseInt(qtyStr, 10) || 1);
    const flowText = cols[3] || '입고';
    const flow = (flowText.includes('출') || flowText.toLowerCase().includes('out')) ? 'OUT' : 'IN';
    const loc = cols[4] || locations[0];
    const mgr = cols[5] || managers[0];

    const validLoc = locations.includes(loc) ? loc : locations[0];
    const validMgr = managers.includes(mgr) ? mgr : managers[0];

    if (title || code) {
      parsed.push({
        code: code.trim(),
        title: (title || code).trim(),
        qty,
        flow,
        loc: validLoc,
        mgr: validMgr,
        memo: memo.trim(),
        serial: serial.trim()
      });
    }
  });

  return parsed;
};
