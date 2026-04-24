import { NextRequest, NextResponse } from 'next/server';
import { WebcastPushConnection } from 'tiktok-live-connector';
import { searchLavalink } from '../../../lib/lavalink';

const globalConnections = new Map<string, WebcastPushConnection>();

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let username = searchParams.get('username');

  if (!username) {
    return new NextResponse('Username required', { status: 400 });
  }

  username = username.replace(/^@/, '').trim();

  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          try { controller.close(); } catch (e) {}
        }
      };

      const sendEvent = (event: string, data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          safeClose();
        }
      };

      let tiktokConn: WebcastPushConnection | null = null;

      req.signal.addEventListener('abort', () => {
        tiktokConn?.disconnect();
        if (username) globalConnections.delete(username);
        safeClose();
      });

      try {
        if (globalConnections.has(username)) {
          const old = globalConnections.get(username);
          old?.disconnect();
          globalConnections.delete(username);
        }

        tiktokConn = new WebcastPushConnection(username, {
          enableWebsocketUpgrade: true,
          processInitialData: false,
          requestPollingIntervalMs: 5000,
          clientParams: { 
            "app_language": "id-ID", 
            "device_platform": "web", 
            "aid": 1988 
          }
        });
        
        globalConnections.set(username, tiktokConn);

        await tiktokConn.connect();
        sendEvent('connected', { message: `Connected to @${username}` });

        // CHAT EVENT
        tiktokConn.on('chat', async (data) => {
          const isCommand = data.comment.startsWith('!play ');
          const msg = {
            user: data.uniqueId,      // @username
            nickname: data.nickname,  // Display Name
            avatar: data.profilePictureUrl,
            comment: data.comment,
            isCommand,
            type: 'chat'
          };
          sendEvent('chat', msg);

          if (isCommand) {
            const query = data.comment.replace('!play ', '').trim();
            const results = await searchLavalink(query);
            if (results?.length > 0) {
              // Priority: Use uniqueId (@username) for the announcement as requested
              sendEvent('track_found', { user: `@${data.uniqueId}`, track: results[0] });
            }
          }
        });

        // GIFT EVENT
        tiktokConn.on('gift', (data) => {
          // repeatEnd ensures we only show the final total for streaks
          if (data.repeatEnd) {
            sendEvent('chat', {
              user: data.uniqueId,
              nickname: data.nickname,
              avatar: data.profilePictureUrl,
              comment: `mengirim ${data.giftName} x${data.repeatCount}`,
              type: 'gift',
              isCommand: false,
              giftData: {
                name: data.giftName,
                count: data.repeatCount,
                image: data.giftPictureUrl
              }
            });
          }
        });

        // JOIN EVENT (MEMBER)
        tiktokConn.on('member', (data) => {
          sendEvent('chat', {
            user: data.uniqueId,
            nickname: data.nickname,
            avatar: data.profilePictureUrl,
            comment: `baru saja bergabung!`,
            type: 'member',
            isCommand: false
          });
        });

        // LIKE EVENT
        tiktokConn.on('like', (data) => {
          // Throttled: only show if they send more than 50 likes to avoid spam
          if (data.likeCount >= 50) {
            sendEvent('chat', {
              user: data.uniqueId,
              nickname: data.nickname,
              avatar: data.profilePictureUrl,
              comment: `memberikan ${data.likeCount} like!`,
              type: 'like',
              isCommand: false
            });
          }
        });

        // SOCIAL EVENT (SHARE/FOLLOW)
        tiktokConn.on('social', (data) => {
          sendEvent('chat', {
            user: data.uniqueId,
            nickname: data.nickname,
            avatar: data.profilePictureUrl,
            comment: data.displayType === 'pm_mt_guidance_share' ? 'membagikan Live ini!' : 'mengikuti DJ!',
            type: 'member',
            isCommand: false
          });
        });

        // VIEWERS UPDATE
        tiktokConn.on('roomUser', (data) => {
          sendEvent('room_update', { viewerCount: data.viewerCount });
        });

        tiktokConn.on('error', (err) => {
          sendEvent('tiktok_error', { message: 'Koneksi TikTok bermasalah...' });
        });

        tiktokConn.on('streamEnd', () => {
          sendEvent('ended', { message: 'Live telah berakhir.' });
          safeClose();
        });

      } catch (err: any) {
        sendEvent('tiktok_error', { message: 'Gagal menyambung. Pastikan akun sedang Live.' });
        safeClose();
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
