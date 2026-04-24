import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  // Security check: Only allow YouTube URLs
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    return new NextResponse('Invalid URL or Not Supported', { status: 403 });
  }

  try {
    const youtube = await Innertube.create();
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();

    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const info = await youtube.getInfo(videoId);
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });

    if (!format) {
      throw new Error('No audio format found');
    }

    const stream = await info.download({
      type: 'audio',
      quality: 'best',
      format: 'mp4'
    });

    // Convert ReadableStream to Web ReadableStream for Next.js response
    const reader = stream.getReader();
    const webStream = new ReadableStream({
      async start(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      },
      cancel() {
        reader.cancel();
      }
    });

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

  } catch (error: any) {
    console.error('Streaming Error:', error);
    return new NextResponse(`Streaming error: ${error.message}`, { status: 500 });
  }
}
