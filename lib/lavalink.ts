import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
      // For albums, we can use similar logic if the API supports it
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
    for (const q of searchQueries.slice(0, 10)) { // Limit to 10 for safety
      const isUrl = q.startsWith("http");
      const ytQuery = isUrl ? q : `ytsearch1:${q}`;
      
      try {
        const { stdout } = await execAsync(`yt-dlp "${ytQuery}" --flat-playlist --dump-json`);
        const lines = stdout.split('\n').filter(l => l.trim() !== '');
        
        for (const line of lines) {
          const data = JSON.parse(line);
          const thumbnail = data.thumbnails && data.thumbnails.length > 0 
            ? data.thumbnails[data.thumbnails.length - 1].url 
            : (data.thumbnail || `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`);

          allResults.push({
            encoded: '',
            info: {
              identifier: data.id,
              isSeekable: true,
              author: data.uploader || data.channel || 'Unknown',
              length: (data.duration || 0) * 1000,
              isStream: data.is_live || data.live_status === 'is_live' || false,
              position: 0,
              title: data.title,
              uri: data.url || data.webpage_url || `https://www.youtube.com/watch?v=${data.id}`,
              artworkUrl: thumbnail,
              isrc: null,
              sourceName: 'youtube'
            },
            pluginInfo: {},
            userData: {}
          });
        }
      } catch (e) {}
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
    latency: '0ms (yt-dlp Bridge)',
    version: 'yt-dlp-spotify-resolver'
  };
}