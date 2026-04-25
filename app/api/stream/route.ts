import { NextRequest } from 'next/server';
import { Innertube, UniversalCache } from 'youtubei.js';

export const dynamic = 'force-dynamic';

let ytInstance: Innertube | null = null;

async function getYt() {
  if (!ytInstance) {
    ytInstance = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true
    });
  }
  return ytInstance;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) return new Response('Missing URL', { status: 400 });

  // Jika bukan YouTube, coba pake proxy/redirect (misal Cobalt)
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    try {
        const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ url, downloadMode: 'audio' })
        }).then(r => r.json());
        
        if (cobaltRes.url) {
            return Response.redirect(cobaltRes.url, 302);
        }
    } catch (e) {
        console.error("Non-YouTube stream fallback failed:", e);
    }
  }

  try {
    const yt = await getYt();

    let videoId = '';
    if (url.includes('v=')) {
      videoId = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    } else {
      videoId = url.split('/').pop() || '';
    }

    if (!videoId || videoId.length !== 11) {
      return new Response('Invalid Video ID', { status: 400 });
    }

    // Menggunakan client TV_EMBEDDED yang sangat stabil untuk streaming
    const info = await yt.getInfo(videoId, 'TV_EMBEDDED');
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });

    if (!format) throw new Error('Format audio tidak ditemukan');

    const rangeHeader = req.headers.get('range');
    const contentLength = format.content_length ? Number(format.content_length) : 0;
    
    const downloadOptions: any = {
      type: 'audio',
      quality: 'best',
      format: 'mp4',
      client: 'TV_EMBEDDED'
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
      'X-Content-Duration': (info.basic_info.duration || 0).toString(),
    };

    if (rangeHeader && contentLength > 0) {
      const start = downloadOptions.range?.start || 0;
      const end = downloadOptions.range?.end || (contentLength - 1);
      headers['Content-Range'] = `bytes ${start}-${end}/${contentLength}`;
      headers['Content-Length'] = (end - start + 1).toString();
    } else if (contentLength > 0) {
      headers['Content-Length'] = contentLength.toString();
    }

    return new Response(stream as any, { status, headers });

  } catch (error: any) {
    console.error('STREAM_ERROR:', error.message);
    // Jika gagal, coba fallback ke ANDROID
    try {
        const yt = await getYt();
        const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
        const info = await yt!.getInfo(videoId!, 'ANDROID');
        const stream = await info.download({ type: 'audio', quality: 'best' });
        return new Response(stream as any, { status: 200, headers: { 'Content-Type': 'audio/mp4' } });
    } catch (e) {
        return new Response(null, { status: 500, headers: { 'X-Error-Message': error.message } });
    }
  }
}
