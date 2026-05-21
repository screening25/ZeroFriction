import { notifyHandler } from '@/backend/services/notify';

export async function POST(request: Request) {
  return notifyHandler(request);
}
