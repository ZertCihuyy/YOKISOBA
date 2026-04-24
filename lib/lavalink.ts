import { Innertube } from 'youtubei.js';

export interface LavalinkTrack {
  encoded: string;
  info: {
    identifier: string;
    isSeekable: boolean;
    author: string;
    length: number;
    isStream: boolean;
    position: number;
    title: string;
    uri: string;
    artworkUrl: string | null;
    isrc: string | null;
    sourceName: string;
  };
  pluginInfo: any;
  userData: any;
}

/**
 * Converts Spotify URL to a Searchable Title using a public metadata API
 */
async function resolveSpotifyMetadata(url: string): Promise<string[]> {
  try {
    const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
    const playlistMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
    const albumMatch = url.match(/album\/([a-zA-Z0-9]+)/);

    if (trackMatch) {
      const res = await fetch(`https://api.spotifydown.com/metadata/track/${trackMatch[1]}`).then(r => r.json());
      return [`${res.title} ${res.artists} official audio` || ''];
    } else if (playlistMatch) {
      const res = await fetch(`https://api.spotifydown.com/metadata/playlist/${playlistMatch[1]}`).then(r => r.json());
      return res.tracks.map((t: any) => `${t.name} ${t.artists[0].name} official audio`);
    } else if (albumMatch) {
      const res = await fetch(`https://api.spotifydown.com/metadata/album/${albumMatch[1]}`).then(r => r.json());
      return res.tracks.map((t: any) => `${t.name} ${t.artists[0].name} official audio`);
    }
  } catch (e) {
    console.error("Spotify Resolve Error:", e);
  }
  return [];
}

/**
 * Search logic with Spotify-to-YouTube conversion
 */
export async function searchLavalink(query: string): Promise<LavalinkTrack[]> {
  try {
    const youtube = await Innertube.create();
    let searchQueries = [query];

    // 1. Check if it's a Spotify URL
    if (query.includes("spotify.com")) {
      const metadata = await resolveSpotifyMetadata(query);
      if (metadata.length > 0) {
        searchQueries = metadata;
      }
    }

    const allResults: LavalinkTrack[] = [];

    // 2. Search each query on YouTube
    for (const q of searchQueries.slice(0, 5)) {
      try {
        const results = await youtube.search(q, { type: 'video' });
        
        // Menggunakan cara yang lebih aman untuk memproses hasil pencarian
        const videos = results.results?.filter((node: any) => node.type === 'Video') || [];

        for (const video of videos as any[]) {
          allResults.push({
            encoded: '',
            info: {
              identifier: video.id,
              isSeekable: true,
              author: video.author?.name || 'Unknown',
              length: (video.duration?.seconds || 0) * 1000,
              isStream: video.is_live || false,
              position: 0,
              title: video.title?.text || video.title || 'Unknown Title',
              uri: `https://www.youtube.com/watch?v=${video.id}`,
              artworkUrl: video.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
              isrc: null,
              sourceName: 'youtube'
            },
            pluginInfo: {},
            userData: {}
          });
        }
      } catch (e) {
        console.error("Single search error:", e);
      }
    }

    return allResults;
  } catch (error) {
    console.error("Search Error:", error);
    return [];
  }
}

export async function getLavalinkStatus() {
  return {
    online: true,
    latency: '0ms (Serverless Bridge)',
    version: 'youtubei-spotify-resolver'
  };
}
