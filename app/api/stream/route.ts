import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

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
    const ytdlp = spawn('yt-dlp', [
      '-f', 'bestaudio',
      '--limit-rate', '10M', // Prevent bandwidth abuse
      '-o', '-',
      url
    ]);

    const stream = new ReadableStream({
      start(controller) {
        ytdlp.stdout.on('data', (chunk) => {
          try {
            controller.enqueue(chunk);
          } catch (e) {}
        });

        ytdlp.stdout.on('end', () => {
          try { controller.close(); } catch (e) {}
        });

        ytdlp.on('error', (err) => {
          console.error('yt-dlp error:', err);
          try { controller.error(err); } catch (e) {}
        });

        ytdlp.on('close', () => {
           try { controller.close(); } catch (e) {}
        });

        // If the client disconnects, kill yt-dlp to save resources
        req.signal.addEventListener('abort', () => {
          ytdlp.kill('SIGTERM');
        });
      },
      cancel() {
        ytdlp.kill('SIGTERM');
      }
    });

    return new NextResponse(stream, {
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
