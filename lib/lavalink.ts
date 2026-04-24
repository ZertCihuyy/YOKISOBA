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

interface LavalinkLoadResult {
  loadType: 'track' | 'playlist' | 'search' | 'empty' | 'error';
  data: any; // Context specific data
}

export async function searchLavalink(query: string): Promise<LavalinkTrack[]> {
  const host = process.env.LAVALINK_HOST || 'lavalinkv4.serenetia.com';
  const port = process.env.LAVALINK_PORT || '443';
  const password = process.env.LAVALINK_PASSWORD || 'https://seretia.link/discord';
  const secure = process.env.LAVALINK_SECURE === 'true';

  const protocol = secure ? 'https' : 'http';
  // Use ytsearch by default if no prefix is provided
  const identifier = query.includes('http') || query.includes(':search:') ? query : `ytsearch:${query}`;
  
  const url = `${protocol}://${host}:${port}/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': password,
        'Client-Name': 'Yakisoba-Web/1.0.0'
      },
      // Removed caching to ensure fresh results always, fixing stale Lavalink data issues.
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('Lavalink API Error:', response.statusText);
      return [];
    }

    const result: LavalinkLoadResult = await response.json();

    if (result.loadType === 'search') {
      return result.data as LavalinkTrack[];
    } else if (result.loadType === 'track') {
      return [result.data as LavalinkTrack];
    } else if (result.loadType === 'playlist') {
      return result.data.tracks as LavalinkTrack[];
    }

    return [];
  } catch (error) {
    console.error('Failed to search Lavalink:', error);
    return [];
  }
}
