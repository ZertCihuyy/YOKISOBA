import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) return new NextResponse('Missing URL', { status: 400 });

  try {
    // Di lingkungan Serverless, lebih aman membuat instance per request 
    // atau gunakan cache yang sangat hati-hati.
    const yt = await Innertube.create();
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    
    if (!videoId) throw new Error('ID Video tidak valid');

    const info = await yt.getInfo(videoId);
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });

    if (!format) throw new Error('Format audio tidak ditemukan');

    const rangeHeader = req.headers.get('range');
    const contentLength = format.content_length ? Number(format.content_length) : 0;
    
    const downloadOptions: any = {
      type: 'audio',
      quality: 'best',
      format: 'mp4',
    };

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : (contentLength > 0 ? contentLength - 1 : undefined);

      if (!isNaN(start)) {
        downloadOptions.range = (end !== undefined && !isNaN(end)) ? { start, end } : { start };
      }
    }

    const stream = await info.download(downloadOptions);

    const status = rangeHeader ? 206 : 200;
    const headers: Record<string, string> = {
      'Content-Type': format.mime_type || 'audio/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    };

    if (rangeHeader && contentLength > 0) {
      const start = downloadOptions.range?.start || 0;
      const end = downloadOptions.range?.end || (contentLength - 1);
      headers['Content-Range'] = `bytes ${start}-${end}/${contentLength}`;
      headers['Content-Length'] = (end - start + 1).toString();
    } else if (contentLength > 0) {
      headers['Content-Length'] = contentLength.toString();
    }

    return new NextResponse(stream as any, { status, headers });

  } catch (error: any) {
    console.error('SERVER_STREAM_ERROR:', error.message);
    // Kirim pesan error sebagai header agar client bisa membacanya
    return new NextResponse(null, { 
      status: 500, 
      headers: { 'X-Error-Message': error.message || 'Unknown Stream Error' } 
    });
  }
}
