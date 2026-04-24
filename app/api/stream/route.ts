import { NextRequest, NextResponse } from 'next/server';
import { Innertube } from 'youtubei.js';

export const dynamic = 'force-dynamic';

// Reuse instance untuk kecepatan
let youtube: Innertube | null = null;

async function getYouTube() {
  if (!youtube) {
    youtube = await Innertube.create();
  }
  return youtube;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) return new NextResponse('Missing URL', { status: 400 });

  try {
    const yt = await getYouTube();
    const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    
    if (!videoId) throw new Error('Invalid ID');

    const info = await yt.getInfo(videoId);
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });

    if (!format) throw new Error('No audio found');

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

    // Kirim stream langsung tanpa membungkus ulang jika memungkinkan
    const status = rangeHeader ? 206 : 200;
    const headers: Record<string, string> = {
      // Gunakan mime_type asli dari YouTube agar browser bisa memutar dengan benar
      'Content-Type': format.mime_type || 'audio/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
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
    console.error('Stream API Error:', error);
    return new NextResponse(`Error: ${error.message}`, { status: 500 });
  }
}
