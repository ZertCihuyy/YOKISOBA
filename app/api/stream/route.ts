import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) return new Response('Missing URL', { status: 400 });

  try {
    // Use Cobalt API for streaming
    const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        url,
        downloadMode: 'audio'
      })
    });

    if (cobaltRes.ok) {
      const cobaltData = await cobaltRes.json();
      if (cobaltData.url) {
        return Response.redirect(cobaltData.url, 302);
      }
    }

    throw new Error('Cobalt API failed');

  } catch (error: any) {
    console.error('STREAM_ERROR:', error.message);
    return new Response(null, { status: 500, headers: { 'X-Error-Message': error.message } });
  }
}
