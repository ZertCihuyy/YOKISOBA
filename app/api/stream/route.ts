import { NextRequest } from 'next/server';
import youtubedl from 'youtube-dl-exec';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

function nodeStreamToWeb(nodeStream: import('stream').Readable) {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    }
  });
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

    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Eksekusi yt-dlp (via youtube-dl-exec) dengan cookies
    const stream = youtubedl.exec(cleanUrl, {
      output: '-', // Tulis ke stdout
      format: 'bestaudio',
      cookies: 'kue-coklat.txt', // Menggunakan cookie root
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
    }, { 
      stdio: ['ignore', 'pipe', 'ignore'] 
    });

    if (!stream.stdout) {
      throw new Error("Gagal membuka stream audio dari youtube-dl-exec");
    }

    // Mengonversi Stream Node.js ke Web ReadableStream untuk Next.js Response
    const webStream = nodeStreamToWeb(stream.stdout);

    return new Response(webStream, { 
      status: 200, 
      headers: { 
        'Content-Type': 'audio/webm', // Secara umum webm/mp4 audio
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      } 
    });

  } catch (error: any) {
    console.error('STREAM_ERROR via youtube-dl-exec:', error.message);
    
    // Fallback ke Cobalt API (Bypass)
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
        return new Response(null, { status: 500, headers: { 'X-Error-Message': error.message } });
    }
    
    return new Response(null, { status: 500, headers: { 'X-Error-Message': error.message } });
  }
}
