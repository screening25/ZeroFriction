import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** PolicyTracker CRUD — DB 접근은 prisma 어댑터로 격리. */
export async function listPolicies(): Promise<NextResponse> {
  try {
    const policies = await prisma.policyTracker.findMany({ orderBy: { effectiveDate: 'asc' } });
    return NextResponse.json(policies);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function createPolicy(req: Request): Promise<NextResponse> {
  try {
    const data = await req.json();
    const policy = await prisma.policyTracker.create({ data });
    return NextResponse.json(policy);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function updatePolicy(req: Request): Promise<NextResponse> {
  try {
    const { id, ...data } = await req.json();
    const policy = await prisma.policyTracker.update({ where: { id }, data });
    return NextResponse.json(policy);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function deletePolicy(req: Request): Promise<NextResponse> {
  try {
    const { id } = await req.json();
    await prisma.policyTracker.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
