import { Innertube, UniversalCache } from 'youtubei.js';

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

const LAVALINK_HOST = process.env.LAVALINK_HOST || 'http://sg1-nodelink.nyxbot.app:3000';
const LAVALINK_PASS = process.env.LAVALINK_PASS || 'nyxbot.app/support';

// Global instance untuk reuse (Singleton)
let ytInstance: Innertube | null = null;

async function getYt() {
  if (!ytInstance) {
    ytInstance = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true
    });
  }
  return ytInstance;
}

export async function searchLavalink(query: string): Promise<LavalinkTrack[]> {
  try {
    // 1. Coba pake Lavalink Asli (Proxy)
    let identifier = query;
    if (query.includes('spotify.com')) {
      identifier = `${query}`; // Lavalink v4 supports spotify urls directly with plugins
    } else if (!query.startsWith('http')) {
      identifier = `ytsearch:${query}`;
    }

    const lavalinkUrl = `${LAVALINK_HOST}/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`;
    
    try {
      const res = await fetch(lavalinkUrl, {
        headers: { 'Authorization': LAVALINK_PASS }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.loadType === 'track' || data.loadType === 'playlist' || data.loadType === 'search') {
          if (data.loadType === 'playlist') return data.data.tracks;
          if (data.loadType === 'search') return data.data;
          if (data.loadType === 'track') return [data.data];
        }
      }
    } catch (e) {
      console.warn("Lavalink primary failed, falling back to youtubei:", e);
    }

    // 2. Fallback ke youtubei.js (Mekanisme lama)
    const yt = await getYt();
    const search = await yt.search(query, { type: 'video' });
    
    if (!search.videos || search.videos.length === 0) return [];

    return search.videos.filter(v => v.type === 'Video').map(video => ({
      encoded: '',
      info: {
        identifier: (video as any).id,
        isSeekable: true,
        author: (video as any).author?.name || 'Unknown Artist',
        length: ((video as any).duration?.seconds || 0) * 1000,
        isStream: (video as any).is_live || false,
        position: 0,
        title: (video as any).title?.text || (video as any).title || 'Unknown Title',
        uri: `https://www.youtube.com/watch?v=${(video as any).id}`,
        artworkUrl: (video as any).thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${(video as any).id}/hqdefault.jpg`,
        isrc: null,
        sourceName: 'youtube'
      },
      pluginInfo: {},
      userData: {}
    }));

  } catch (error) {
    console.error("Lavalink Search Fatal Error:", error);
    return [];
  }
}

export async function getLavalinkStatus() {
  try {
    const res = await fetch(`${LAVALINK_HOST}/v4/info`, {
      headers: { 'Authorization': LAVALINK_PASS }
    });
    if (res.ok) {
      const data = await res.json();
      return { online: true, version: data.version.semver, source: 'real-lavalink' };
    }
  } catch (e) {}
  
  return { 
    online: true, 
    latency: '0ms', 
    version: 'youtubei-bridge-v2',
    source: 'fallback'
  };
}
