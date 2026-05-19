import { NextResponse } from 'next/server';
import { parseFallback } from './parser';
import { callGeminiParse } from './gemini';

/**
 * /api/parse 의 비즈니스 로직 진입점.
 * 1) API Key가 없으면 룰 기반 fallback 으로 응답.
 * 2) Gemini 호출 성공 시 그 결과를 반환.
 * 3) Gemini 실패 시 fallback 으로 graceful degradation.
 */
export async function parseHandler(req: Request): Promise<NextResponse> {
  let text = '';
  try {
    const body = await req.json();
    text = body.text || '';
    const apiKey = body.apiKey;
    const finalApiKey = apiKey || process.env.GEMINI_API_KEY;

    if (!finalApiKey) {
      console.warn('No API_KEY found, using rule-based parser fallback.');
      return NextResponse.json({ ...parseFallback(text), _parser: 'fallback', _error: 'API Key가 설정되어 있지 않습니다.' });
    }

    const result = await callGeminiParse(text, finalApiKey);
    return NextResponse.json({ ...result, _parser: 'gemini' });
  } catch (error: any) {
    console.error('Gemini API error, falling back to rule-based parser:', error.message);
    try {
      return NextResponse.json({ ...parseFallback(text), _parser: 'fallback', _error: error.message });
    } catch (fallbackError: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
}

export { parseFallback } from './parser';
export { callGeminiParse } from './gemini';
export { buildParsePrompt } from './prompts';
