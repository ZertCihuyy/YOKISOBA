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
    // 1. Get the stream URL using youtube-dl-exec (yt-dlp)
    // We prioritize m4a for maximum compatibility with all browsers (including mobile/Safari)
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      format: 'bestaudio[ext=m4a]/bestaudio/best',
      youtubeSkipDashManifest: true,
    }) as any;

    if (!output || typeof output !== 'object' || !output.url) {
      return new NextResponse('No suitable audio stream found', { status: 404 });
    }

    // 2. Handle Range requests from the browser
    // Browsers often send 'Range' headers to buffer audio. We must pass this to YouTube.
    const range = req.headers.get('range');
    
    const response = await fetch(output.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/',
        ...(range ? { 'Range': range } : {}),
      },
    });

    if (!response.ok || !response.body) {
      // Fallback to redirect if proxying fails
      return NextResponse.redirect(output.url);
    }

    // 3. Construct the response with proper streaming headers
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', response.headers.get('Content-Type') || 'audio/mp4');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // If YouTube responded with partial content (206), we should too
    if (response.status === 206) {
      responseHeaders.set('Content-Range', response.headers.get('Content-Range') || '');
      responseHeaders.set('Accept-Ranges', 'bytes');
      return new NextResponse(response.body, {
        status: 206,
        headers: responseHeaders,
      });
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error('Streaming proxy error:', error);
    return new NextResponse(`Error: ${error.message}`, { status: 500 });
  }
}
