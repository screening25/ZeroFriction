import { parseHandler } from '@/backend/services/llm';

export async function POST(req: Request) {
  return parseHandler(req);
}
