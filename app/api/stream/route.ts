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
    // RESOLVE: Use youtube-dl-exec with better fallback formats
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      format: 'bestaudio[ext=m4a]/bestaudio/best',
      youtubeSkipDashManifest: true,
    }) as any;

    if (!output || !output.url) {
      return new NextResponse('Audio source resolution failed', { status: 404 });
    }

    // CORS & SECURITY HEADERS
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Return the resolved URL as JSON for the client-side player
    // This is much safer than server-side proxying which usually leads to timeouts
    if (req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json({ 
        url: output.url,
        title: output.title,
        duration: output.duration 
      });
    }

    // Direct redirect fallback
    return NextResponse.redirect(output.url, {
      status: 307,
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error('[Stream API Error]', error);
    return new NextResponse(`Streaming error: ${error.message}`, { status: 500 });
  }
}
