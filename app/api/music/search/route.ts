import { NextRequest, NextResponse } from 'next/server';
import { searchLavalink } from '../../../../lib/lavalink';

/**
 * API Music Search - Proxy Lavalink
 * Best practice for backend proxying to keep credentials secure.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Parameter "q" (query) wajib diisi!' }, { status: 400 });
  }

  try {
    const results = await searchLavalink(query);
    
    if (!results || results.length === 0) {
        return NextResponse.json({ loadType: 'empty', data: [] });
    }

    return NextResponse.json({
        loadType: 'search',
        data: results
    });

  } catch (error) {
    console.error('Lavalink Proxy Error:', error);
    return NextResponse.json({ error: 'Gagal menghubungi server musik.' }, { status: 500 });
  }
}
