import { NextRequest, NextResponse } from 'next/server';
import youtubedl from 'youtube-dl-exec';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    // 1. Get raw info from YouTube
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      // Priority: m4a > any audio
      format: 'bestaudio[ext=m4a]/bestaudio/best',
      youtubeSkipDashManifest: true,
    }) as any;

    if (!output || !output.url) {
      return new NextResponse('Could not resolve stream URL', { status: 404 });
    }

    // 2. Return URL as JSON for the client player
    if (req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({ url: output.url });
    }

    // 3. Fallback to direct redirect with modern headers
    return NextResponse.redirect(output.url, {
      status: 307,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

  } catch (error: any) {
    console.error('Streaming Error:', error);
    return new NextResponse(`Streaming error: ${error.message}`, { status: 500 });
  }
}
