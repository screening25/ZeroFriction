import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Schedule CRUD — DB 접근은 prisma 어댑터로 격리. */
export async function listSchedules(): Promise<NextResponse> {
  try {
    const schedules = await prisma.schedule.findMany({ orderBy: { date: 'asc' } });
    return NextResponse.json(schedules);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function createSchedule(req: Request): Promise<NextResponse> {
  try {
    const data = await req.json();
    const schedule = await prisma.schedule.create({ data });
    return NextResponse.json(schedule);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function updateSchedule(req: Request): Promise<NextResponse> {
  try {
    const { id, ...data } = await req.json();
    const schedule = await prisma.schedule.update({ where: { id }, data });
    return NextResponse.json(schedule);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function deleteSchedule(req: Request): Promise<NextResponse> {
  try {
    const { id } = await req.json();
    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
