import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Vercel 서버리스 요청 본문 한도(4.5MB) 안에서 동작하도록 파일당 4MB로 제한한다.
const MAX_FILE_SIZE = 4 * 1024 * 1024;

/**
 * 첨부파일 업로드 — 본문(raw binary)을 그대로 저장하고 메타데이터를 반환한다.
 * 쿼리: name(파일명), mime(콘텐츠 타입). 레코드에는 반환된 메타데이터만 저장한다.
 */
export async function uploadFile(req: Request): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const name = url.searchParams.get('name') || 'file';
    const mime = url.searchParams.get('mime') || 'application/octet-stream';
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json({ error: 'empty file' }, { status: 400 });
    }
    if (buf.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'file too large (max 4MB)' }, { status: 413 });
    }
    const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await prisma.attachment.create({ data: { id, name, mime, size: buf.length, data: buf } });
    return NextResponse.json({ id, name, mime, size: buf.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** 첨부파일 본문을 원래 콘텐츠 타입으로 반환한다 (브라우저에서 바로 열기/다운로드). */
export async function getFile(id: string): Promise<Response> {
  try {
    const file = await prisma.attachment.findUnique({ where: { id } });
    if (!file) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    // 한글 파일명 지원 — RFC 5987 filename* 인코딩
    const encodedName = encodeURIComponent(file.name).replace(/['()]/g, escape);
    return new Response(Buffer.from(file.data), {
      headers: {
        'Content-Type': file.mime,
        'Content-Length': String(file.size),
        'Content-Disposition': `inline; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** 첨부파일 삭제 — UI에서 첨부를 제거할 때 호출한다(없어도 성공으로 응답). */
export async function deleteFile(id: string): Promise<NextResponse> {
  try {
    await prisma.attachment.deleteMany({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
