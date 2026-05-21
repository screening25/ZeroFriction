/**
 * Rule-based NLP parser (Gemini API 미사용/실패 시 fallback).
 * Pure-function 모듈: 외부 I/O 없음. Backend 영역에서만 사용.
 */

export type ParserAction = 'C' | 'U' | 'D' | 'R';
export interface ParsedCommand {
  a: ParserAction;
  t: string;
  c: string;
  v: string;
  attr: Record<string, any>;
  rec: 'none' | 'daily' | 'weekly' | 'monthly';
  link: string[];
  k: string;
}

export function detectRecurrence(text: string): 'none' | 'daily' | 'weekly' | 'monthly' {
  if (/매일|날마다|every\s*day/i.test(text)) return 'daily';
  if (/매주|주마다|every\s*week|매\s*월요일|매\s*화요일|매\s*수요일|매\s*목요일|매\s*금요일|매\s*토요일|매\s*일요일/i.test(text)) return 'weekly';
  if (/매달|매월|월마다|every\s*month/i.test(text)) return 'monthly';
  return 'none';
}

export function extractLinkKeywords(text: string): string[] {
  const hashes = Array.from(text.matchAll(/[#@]([가-힣A-Za-z0-9_-]{2,})/g)).map(m => m[1]);
  return Array.from(new Set(hashes));
}

export function parseFallback(text: string): ParsedCommand {
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const rec = detectRecurrence(text);
  const link = extractLinkKeywords(text);

  // 검색/조회(READ) 의도 감지
  const isReadIntent = /(찾아|검색|보여|뭐 있|뭐있|있어\??$|있나|얼마나|총|어떤|어떻게|언제|몇\s*개|몇건|상태|현황|리스트|목록)/.test(text)
    && !/(등록|입고|출고|추가|삭제|취소|수정|변경|연기|미뤄|지워|없애)/.test(text);
  if (isReadIntent) {
    let inferType: string = '';
    if (/재고|입고|출고|품목|물품|stock/i.test(text)) inferType = 'asset';
    else if (/일정|미팅|회의|약속|event/i.test(text)) inferType = 'event';
    else if (/메모|변동|기록|memo/i.test(text)) inferType = 'memo';
    const k = text.replace(/(찾아|검색|보여|있어\??|있나|얼마나|총|어떤|어떻게|언제|몇\s*개|몇건|상태|현황|리스트|목록|좀|줘|봐|해줘|줄래|볼래|줄\s*수|있나요|있습니까|\?|뭐|뭐가|뭐\s있|에서|에|을|를|이|가|은|는|의|\s)/g, '').trim();
    return { a: 'R', t: inferType, c: '', v: '', attr: {}, rec: 'none', link: [], k: k || text.trim() };
  }

  // 대괄호 카테고리
  let customCategory: string | null = null;
  const bracketMatch = text.match(/^\[([^\]]+)\]/);
  let cleanedText = text;
  if (bracketMatch) {
    customCategory = bracketMatch[1].trim();
    cleanedText = text.replace(/^\[[^\]]+\]\s*/, '');
  }
  cleanedText = cleanedText.replace(/[#@][가-힣A-Za-z0-9_-]{2,}/g, '').trim();

  // 1-A. 콤마(,) 구분형 재고 처리
  if (cleanedText.includes(',') || cleanedText.toLowerCase().includes('inbound') || cleanedText.toLowerCase().includes('outbound')) {
    const parts = cleanedText.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      const code = parts[0];
      const itemName = parts[1];
      const qtyPart = parts[2];
      const qtyMatch = qtyPart.match(/(\d+)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      let flow = 'IN';
      if (cleanedText.toLowerCase().includes('outbound') || cleanedText.includes('출고') || cleanedText.toLowerCase().includes('out')) {
        flow = 'OUT';
      }
      const resolvedCategory = customCategory || '재고';
      return {
        a: 'C', t: 'asset', c: resolvedCategory, v: itemName,
        attr: { flow, qty, code, category: resolvedCategory, loc: '', mgr: '', demo: false },
        rec, link, k: ''
      };
    }
  }

  // 1-B. 한국어 재고 정규식
  const invRegex = /([가-힣a-zA-Z0-9\s-]+?)\s*(\d+)\s*(대|개|벌|개수|명)?\s*(입고|출고|등록|삭제|수정|반품)/;
  const invMatch = cleanedText.match(invRegex);
  if (invMatch) {
    const itemName = invMatch[1].trim();
    const qty = parseInt(invMatch[2], 10);
    const actionWord = invMatch[4];
    let flow = 'IN';
    if (actionWord === '출고' || actionWord === '반품') flow = 'OUT';
    const resolvedCategory = customCategory || '재고';
    return {
      a: 'C', t: 'asset', c: resolvedCategory, v: itemName,
      attr: { flow, qty, code: '', category: resolvedCategory, loc: '', mgr: '', demo: false },
      rec, link, k: ''
    };
  }

  // 2. DELETE
  if (cleanedText.includes('취소') || cleanedText.includes('삭제') || cleanedText.includes('지워') || cleanedText.includes('없애')) {
    const target = cleanedText.replace(/(일정|예약|회의|미팅|취소|삭제|해줘|지워줘|없애줘|재고|메모|물품|\s)/g, '');
    let type = 'event';
    let category = '일반';
    if (cleanedText.includes('재고') || cleanedText.includes('물품')) { type = 'asset'; category = customCategory || '재고'; }
    else if (cleanedText.includes('메모')) { type = 'memo'; category = '메모'; }
    return { a: 'D', t: type, c: customCategory || category, v: '', attr: {}, rec: 'none', link: [], k: target || cleanedText.slice(0, 5) };
  }

  // 3. UPDATE
  if (cleanedText.includes('변경') || cleanedText.includes('수정') || cleanedText.includes('미뤄') || cleanedText.includes('연기')) {
    const target = cleanedText.replace(/(일정|예약|회의|미팅|변경|수정|미뤄줘|연기|해줘|로|재고|물품|메모|\s)/g, '');
    let type = 'event';
    let category = '일반';
    if (cleanedText.includes('재고') || cleanedText.includes('물품')) { type = 'asset'; category = customCategory || '재고'; }
    else if (cleanedText.includes('메모')) { type = 'memo'; category = '메모'; }
    let date = todayStr;
    if (cleanedText.includes('내일')) {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      date = tomorrow.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    } else if (cleanedText.includes('모레')) {
      const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);
      date = dayAfter.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    }
    return { a: 'U', t: type, c: customCategory || category, v: '', attr: { date, category: customCategory || category }, rec, link, k: target || cleanedText.slice(0, 5) };
  }

  // 4. ADD_MEMO
  if (cleanedText.includes('공지') || cleanedText.includes('정책') || cleanedText.includes('메모') || cleanedText.includes('기록') || cleanedText.length > 25) {
    return {
      a: 'C', t: 'memo', c: '메모',
      v: cleanedText.length > 15 ? cleanedText.substring(0, 15) + '...' : cleanedText,
      attr: { content: cleanedText }, rec, link, k: ''
    };
  }

  // 5. CREATE_SCHEDULE
  let date = todayStr;
  const dateRegex = /(\d{1,2})일(에|은|는)?/;
  const dateMatch = cleanedText.match(dateRegex);
  if (dateMatch) {
    const targetDay = parseInt(dateMatch[1], 10);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(targetDay).padStart(2, '0');
    date = `${year}-${month}-${day}`;
  } else if (cleanedText.includes('내일')) {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    date = tomorrow.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  } else if (cleanedText.includes('모레')) {
    const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);
    date = dayAfter.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  }

  let time: string | null = null;
  const timeRegex = /(오전|오후)?\s*(\d{1,2})시\s*(\d{1,2})?분?/;
  const timeMatch = cleanedText.match(timeRegex);
  if (timeMatch) {
    let hour = parseInt(timeMatch[2], 10);
    const isPm = timeMatch[1] === '오후';
    if (isPm && hour < 12) hour += 12;
    else if (!isPm && hour === 12) hour = 0;
    if (!timeMatch[1] && hour >= 1 && hour <= 7) hour += 12;
    let minute = '00';
    if (timeMatch[3]) minute = timeMatch[3].padStart(2, '0');
    else if (cleanedText.includes('시 반') || cleanedText.includes('시반')) minute = '30';
    time = `${hour.toString().padStart(2, '0')}:${minute}`;
  }

  let inferredCategory = '일반';
  if (cleanedText.includes('치과') || cleanedText.includes('병원') || cleanedText.includes('운동') || cleanedText.includes('러닝')) inferredCategory = 'HEALTH';
  else if (cleanedText.includes('회의') || cleanedText.includes('미팅') || cleanedText.includes('보고') || cleanedText.includes('업무')) inferredCategory = 'WORK';
  else if (cleanedText.includes('약속') || cleanedText.includes('친구') || cleanedText.includes('생일')) inferredCategory = 'PERSONAL';

  const resolvedCategory = customCategory || inferredCategory;
  let titleCleaned = cleanedText;
  titleCleaned = titleCleaned.replace(/\d{1,2}일(에|은|는)?/g, '');
  titleCleaned = titleCleaned.replace(/(오늘|내일|모레)/g, '');
  titleCleaned = titleCleaned.replace(/(오전|오후)?\s*\d{1,2}시\s*(\d{1,2}분)?\s*(반)?\s*(에|은|는|이|가)?/g, '');
  titleCleaned = titleCleaned.trim();
  const finalTitle = titleCleaned || cleanedText;

  return {
    a: 'C', t: 'event', c: resolvedCategory, v: finalTitle,
    attr: { date, time, category: resolvedCategory, memo: null },
    rec, link, k: ''
  };
}
