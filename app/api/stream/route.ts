import { NextRequest, NextResponse } from 'next/server';
import youtubedl from 'youtube-dl-exec';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    // Fetch metadata
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      format: 'bestaudio/best',
      youtubeSkipDashManifest: true,
    }) as any;

    if (!output || typeof output !== 'object' || !output.url) {
      return new NextResponse('No suitable audio stream found', { status: 404 });
    }

    // Proxy the stream to avoid IP-bound URL issues and 403 Forbidden
    const response = await fetch(output.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/',
      },
    });

    if (!response.ok || !response.body) {
      // If proxy fails, try one last redirect as fallback
      return NextResponse.redirect(output.url);
    }

    // Stream the data back with proper CORS and content type
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error: any) {
    console.error('Streaming error:', error);
    return new NextResponse(`Error resolving audio: ${error.message}`, { status: 500 });
  }
}
