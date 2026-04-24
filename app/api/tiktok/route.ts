import { NextRequest, NextResponse } from 'next/server';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { searchLavalink } from '../../../lib/lavalink';

const globalConnections = new Map<string, WebcastPushConnection>();

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');

  if (!username) {
    return new NextResponse('Username required', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {}
      };

      let tiktokConn: WebcastPushConnection | null = null;

      try {
        if (globalConnections.has(username)) {
          const old = globalConnections.get(username);
          old?.disconnect();
          globalConnections.delete(username);
        }

        tiktokConn = new WebcastPushConnection(username, {
          enableWebsocketUpgrade: true,
          requestPollingIntervalMs: 5000,
          clientParams: { 
            "app_language": "id-ID", 
            "device_platform": "web",
            "aid": 1988 // Add AID for better connection stability
          }
        });
        
        globalConnections.set(username, tiktokConn);

        // Wrap connect in a timeout
        const connectPromise = tiktokConn.connect();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 15000)
        );

        await Promise.race([connectPromise, timeoutPromise]);
        
        sendEvent('connected', { message: `Connected to ${username}` });

        tiktokConn.on('chat', async (data) => {
          if (data.comment.startsWith('!play ')) {
            const query = data.comment.replace('!play ', '').trim();
            sendEvent('chat', { user: data.uniqueId, comment: data.comment, isCommand: true });
            const results = await searchLavalink(query);
            if (results?.length > 0) {
              sendEvent('track_found', { user: data.uniqueId, track: results[0] });
            } else {
              sendEvent('tiktok_error', { message: `Song not found: ${query}` });
            }
          } else {
            sendEvent('chat', { user: data.uniqueId, comment: data.comment, isCommand: false });
          }
        });

        tiktokConn.on('error', (err) => {
          console.error('[TikTok Error]', err);
          sendEvent('tiktok_error', { message: err.message || 'Stream connection issue' });
        });

        tiktokConn.on('streamEnd', () => {
          sendEvent('ended', { message: 'Live ended' });
          controller.close();
        });

      } catch (err: any) {
        console.error('[TikTok Connection Failed]', err);
        const errorMsg = err.message?.includes('not found') 
          ? 'Username not found or invalid.' 
          : 'User might be offline or stream is private.';
        sendEvent('tiktok_error', { message: errorMsg });
        controller.close();
      }

      req.signal.addEventListener('abort', () => {
        tiktokConn?.disconnect();
        if (username) globalConnections.delete(username);
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
