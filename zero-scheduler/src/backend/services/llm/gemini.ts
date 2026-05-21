import { GoogleGenAI, Type } from '@google/genai';
import { buildParsePrompt } from './prompts';

/**
 * Gemini 호출 — 정형화된 JSON 응답을 반환한다.
 * Pure server-side, NextResponse 등 라우팅 의존성 없음.
 */
export async function callGeminiParse(text: string, apiKey: string): Promise<any> {
  const ai = new GoogleGenAI({ apiKey });
  const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  const prompt = buildParsePrompt(text, today);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          a: { type: Type.STRING, description: 'C, U, D, R 중 하나' },
          t: { type: Type.STRING, description: 'event, asset, memo 중 하나' },
          c: { type: Type.STRING, description: '자동 분류된 카테고리명' },
          v: { type: Type.STRING, description: '제목 또는 내용' },
          attr: {
            type: Type.OBJECT,
            properties: {
              flow: { type: Type.STRING, nullable: true },
              qty: { type: Type.INTEGER, nullable: true },
              code: { type: Type.STRING, nullable: true },
              loc: { type: Type.STRING, nullable: true },
              mgr: { type: Type.STRING, nullable: true },
              demo: { type: Type.BOOLEAN, nullable: true },
              date: { type: Type.STRING, nullable: true },
              time: { type: Type.STRING, nullable: true },
              category: { type: Type.STRING, nullable: true },
              memo: { type: Type.STRING, nullable: true },
              content: { type: Type.STRING, nullable: true }
            }
          },
          rec: { type: Type.STRING, description: 'none/daily/weekly/monthly', nullable: true },
          link: { type: Type.ARRAY, items: { type: Type.STRING }, description: '연관 키워드 배열', nullable: true },
          k: { type: Type.STRING, description: '검색 키워드', nullable: true }
        },
        required: ['a', 't', 'c', 'v']
      }
    }
  });

  return JSON.parse(response.text || '{}');
}
