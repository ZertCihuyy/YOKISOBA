import { NextRequest, NextResponse } from 'next/server';
import youtubedl from 'youtube-dl-exec';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    // Get the best audio format URL
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      format: 'bestaudio',
    });

    if (!output || !output.url) {
      return new NextResponse('No suitable audio stream found', { status: 404 });
    }

    // Redirect the browser directly to the YouTube audio stream URL.
    // This saves server bandwidth and works perfectly with the HTML5 <audio> element!
    return NextResponse.redirect(output.url);

  } catch (error) {
    console.error('Streaming error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
