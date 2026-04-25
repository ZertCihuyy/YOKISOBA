import { NextRequest } from 'next/server';

/**
 * Cadangan Ke-3: Proxy ke Server Lavalink Gratis/Publik
 * Menggunakan Invidious atau API Music publik sebagai backup
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return new Response('Missing ID', { status: 400 });

  // List Server Cobalt / Backup API untuk Lavalink Stream
  const providers = [
    `https://cobalt-api.kwi.li/api/json`,
    `https://api.cobalt.tools/api/json`
  ];

  try {
    for (const api of providers) {
      try {
        const res = await fetch(api, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${id}`,
            downloadMode: 'audio',
            audioFormat: 'mp3'
          })
        }).then(r => r.json());

        if (res.url) {
          // Redirect browser ke URL stream audio dari provider
          return Response.redirect(res.url, 302);
        }
      } catch (e) {
        continue;
      }
    }
    
    throw new Error("Semua provider gagal");
  } catch (error) {
    return new Response(null, { status: 500 });
  }
}
