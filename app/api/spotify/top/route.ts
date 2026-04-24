import { NextResponse } from 'next/server';
import { searchLavalink } from '../../../../lib/lavalink';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Instead of a direct Spotify link which has DRM issues, 
    // we search for the "Top Global Songs" on YouTube.
    const results = await searchLavalink("Top Global Songs 2026");
    
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch top songs' }, { status: 500 });
  }
}
