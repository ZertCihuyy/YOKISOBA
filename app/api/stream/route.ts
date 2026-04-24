import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) return new NextResponse('Missing URL', { status: 400 });

  try {
    const youtube = await Innertube.create();
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    
    if (!videoId) throw new Error('Invalid ID');

    const info = await youtube.getInfo(videoId);
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });

    if (!format) throw new Error('No audio found');

    const range = req.headers.get('range');
    const contentLength = format.content_length ? Number(format.content_length) : 0;
    
    let start = 0;
    let end = contentLength > 0 ? contentLength - 1 : undefined;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      start = parseInt(parts[0], 10);
      if (parts[1]) end = parseInt(parts[1], 10);
    }

    const stream = await info.download({
      type: 'audio',
      quality: 'best',
      format: 'mp4',
      range: { start, end }
    });

    const reader = stream.getReader();
    const webStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
      cancel() {
        reader.cancel();
      }
    });

    const status = range ? 206 : 200;
    const headers: Record<string, string> = {
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    };

    if (range && contentLength > 0) {
      headers['Content-Range'] = `bytes ${start}-${end}/${contentLength}`;
      headers['Content-Length'] = (Number(end) - start + 1).toString();
    }

    return new NextResponse(webStream, { status, headers });

  } catch (error: any) {
    console.error('Stream Error:', error);
    return new NextResponse('Error', { status: 500 });
  }
}
