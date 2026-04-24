import { NextRequest, NextResponse } from 'next/server';
import youtubedl from 'youtube-dl-exec';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    // 1. Get the raw stream URL from YouTube (via youtubedl)
    // Cast to any to bypass the restrictive type definitions of youtube-dl-exec
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      format: 'bestaudio',
    }) as any;

    if (!output || typeof output !== 'object' || !output.url) {
      return new NextResponse('No suitable audio stream found', { status: 404 });
    }

    // 2. Fetch the stream from YouTube with proper headers to avoid 403
    const response = await fetch(output.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok || !response.body) {
      return NextResponse.redirect(output.url);
    }

    // 3. Stream the response back to the client
    const { readable, writable } = new TransformStream();
    response.body.pipeTo(writable).catch(err => console.error('Pipe error:', err));

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'audio/webm',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error) {
    console.error('Streaming error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
