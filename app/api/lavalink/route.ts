import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const query = searchParams.get('q');

  // 1. Magic Circle: Lavalink Proxy Search (Requested Feature)
  if (query) {
    const HOST = 'http://sg1-nodelink.nyxbot.app:3000';
    const PASS = 'nyxbot.app/support';
    const lavalinkUrl = `${HOST}/v4/loadtracks?identifier=ytsearch:${encodeURIComponent(query)}`;

    try {
      const response = await fetch(lavalinkUrl, {
        headers: { 'Authorization': PASS }
      });

      const data = await response.json();

      if (data.loadType === 'search') {
        return NextResponse.json(data.data);
      } else if (data.loadType === 'track') {
        return NextResponse.json([data.data]);
      } else {
        return NextResponse.json({ message: 'Lagu tidak ditemukan di database' }, { status: 404 });
      }
    } catch (err) {
      return NextResponse.json({ error: 'Server Lavalink lagi down/error' }, { status: 500 });
    }
  }

  // 2. Backup Stream: Cobalt Logic (Existing Feature)
  if (id) {
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
            return NextResponse.redirect(res.url, 302);
          }
        } catch (e) {
          continue;
        }
      }
      throw new Error("Semua provider gagal");
    } catch (error) {
      return new NextResponse(null, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Missing "q" or "id" parameter' }, { status: 400 });
}
