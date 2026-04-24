import { NextResponse } from 'next/server';
import { searchLavalink } from '../../../../lib/lavalink';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Riffy-Spotify supports resolving spotify links. 
    // We can use a search query for "top hits" or a specific playlist.
    // For "Top Songs", we'll fetch a popular global chart.
    const results = await searchLavalink("https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwK2YIq");
    
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch top songs' }, { status: 500 });
  }
}
