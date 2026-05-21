import { listSchedules, createSchedule, updateSchedule, deleteSchedule } from '@/backend/services/schedule';

export async function GET() { return listSchedules(); }
export async function POST(req: Request) { return createSchedule(req); }
export async function PUT(req: Request) { return updateSchedule(req); }
export async function DELETE(req: Request) { return deleteSchedule(req); }
