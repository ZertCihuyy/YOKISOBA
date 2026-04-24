import { NextRequest, NextResponse } from 'next/server';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { searchLavalink } from '../../../lib/lavalink';

// Store connections globally in development so they aren't lost on hot-reload
const globalConnections: Record<string, WebcastPushConnection> = {};

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
        } catch (e) {
          // Ignore enqueue errors if stream is closed
        }
      };

      try {
        // Disconnect existing if any to prevent conflicts
        if (globalConnections[username]) {
          try {
            globalConnections[username].disconnect();
          } catch(e) {}
          delete globalConnections[username];
        }

        console.log(`[TikTok] Connecting to ${username}...`);
        
        const tiktokLiveConnection = new WebcastPushConnection(username, {
          processInitialData: false,
          enableExtendedGiftInfo: false,
          enableWebsocketUpgrade: true,
          requestPollingIntervalMs: 2000,
          clientParams: {
            "app_language": "id-ID",
            "device_platform": "web"
          }
        });
        
        globalConnections[username] = tiktokLiveConnection;

        await tiktokLiveConnection.connect();
        console.log(`[TikTok] Connected to ${username}`);
        sendEvent('connected', { message: `Connected to ${username}'s live stream` });

        tiktokLiveConnection.on('chat', async (data) => {
          const text = data.comment;
          if (text.startsWith('!play ')) {
            const query = text.replace('!play ', '').trim();
            sendEvent('chat', { user: data.uniqueId, comment: text, isCommand: true });
            
            // Search via Lavalink
            try {
              const results = await searchLavalink(query);
              if (results && results.length > 0) {
                const track = results[0];
                sendEvent('track_found', { user: data.uniqueId, track });
              } else {
                sendEvent('error', { message: `Could not find song: ${query}` });
              }
            } catch (err) {
              console.error('[Lavalink] Search failed', err);
            }
          } else {
            sendEvent('chat', { user: data.uniqueId, comment: text, isCommand: false });
          }
        });

        tiktokLiveConnection.on('streamEnd', () => {
          console.log(`[TikTok] Stream ended for ${username}`);
          sendEvent('ended', { message: 'Stream ended' });
          try { controller.close(); } catch(e) {}
        });

        tiktokLiveConnection.on('error', (err) => {
          console.error(`[TikTok] Connection error for ${username}:`, err);
          sendEvent('error', { message: err.message || 'Connection error' });
        });

        tiktokLiveConnection.on('disconnected', () => {
             console.log(`[TikTok] Disconnected from ${username}`);
             sendEvent('error', { message: 'Disconnected from TikTok' });
             try { controller.close(); } catch(e) {}
        });

        req.signal.addEventListener('abort', () => {
          console.log(`[TikTok] Client aborted connection for ${username}`);
          if (globalConnections[username]) {
             globalConnections[username].disconnect();
             delete globalConnections[username];
          }
        });

      } catch (err: any) {
        console.error(`[TikTok] Failed to connect to ${username}:`, err);
        sendEvent('error', { message: err.toString() || 'Failed to connect' });
        try { controller.close(); } catch(e) {}
      }
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
