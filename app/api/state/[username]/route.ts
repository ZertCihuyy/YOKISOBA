import { NextRequest, NextResponse } from 'next/server';

// Simpan state sederhana di memori (akan hilang jika server restart/serverless mati)
const states: Record<string, any> = {};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  return NextResponse.json(states[username] || { status: 'offline' });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty or malformed body — treat as empty object
  }
  states[username] = { ...body, lastUpdate: Date.now() };
  return NextResponse.json({ success: true });
}
