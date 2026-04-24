import { NextRequest, NextResponse } from 'next/server';

// In-memory store for sync between dashboard and overlays
// Note: On Vercel Serverless, this state might reset if the function cold-starts.
// For production on Vercel, consider using Vercel KV or Redis.
const globalStates: Record<string, any> = {};

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const resolvedParams = await params;
  const username = resolvedParams.username;
  const state = globalStates[username] || { currentTrack: null, queue: [], chat: [], status: 'Disconnected' };
  
  return NextResponse.json(state);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const resolvedParams = await params;
  const username = resolvedParams.username;
  
  try {
    const body = await req.json();
    globalStates[username] = body;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
