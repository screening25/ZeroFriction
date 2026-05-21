import { listPolicies, createPolicy, updatePolicy, deletePolicy } from '@/backend/services/policy';

export async function GET() { return listPolicies(); }
export async function POST(req: Request) { return createPolicy(req); }
export async function PUT(req: Request) { return updatePolicy(req); }
export async function DELETE(req: Request) { return deletePolicy(req); }
