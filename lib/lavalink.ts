import { Riffy } from "riffy";
import { Spotify } from "riffy-spotify";

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

// Singleton for Riffy Manager
let riffy: Riffy | null = null;

export function getRiffy() {
  if (riffy) return riffy;

  const host = process.env.LAVALINK_HOST || 'lavalink.jirayu.net';
  const port = parseInt(process.env.LAVALINK_PORT || '13592');
  const password = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
  const secure = process.env.LAVALINK_SECURE === 'true';

  const spotify = new Spotify({
    clientId: process.env.SPOTIFY_CLIENT_ID || "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || ""
  });

  riffy = new Riffy({
    nodes: [
      {
        host,
        port,
        password,
        secure,
      },
    ],
    send: (payload) => {
        // Not used in web-search mode but required by constructor
    },
    plugins: [spotify]
  });

  return riffy;
}

export async function searchLavalink(query: string): Promise<LavalinkTrack[]> {
  const manager = getRiffy();
  
  // Ensure we use ytsearch for strings that aren't URLs
  const identifier = query.startsWith("http") ? query : `ytsearch:${query}`;
  
  try {
    const result = await manager.resolve({ query: identifier });

    if (!result || result.loadType === "error" || result.loadType === "empty") {
      return [];
    }

    if (result.loadType === "search" || result.loadType === "track") {
      return result.data as any[];
    }

    if (result.loadType === "playlist") {
      return result.data.tracks as any[];
    }

    return [];
  } catch (error) {
    console.error("Riffy Resolve Error:", error);
    return [];
  }
}
