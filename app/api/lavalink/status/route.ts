import { NextResponse } from 'next/server';
import { getLavalinkStatus } from '../../../lib/lavalink';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await getLavalinkStatus();
  return NextResponse.json(status);
}
