import { uploadFile } from '@/backend/services/files';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) { return uploadFile(req); }
