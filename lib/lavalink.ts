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

const host = process.env.LAVALINK_HOST || 'lavalink.jirayu.net';
const port = process.env.LAVALINK_PORT || '13592';
const password = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
const secure = process.env.LAVALINK_SECURE === 'true';

// Singleton for Riffy Manager (used for metadata/plugin logic)
let riffy: Riffy | null = null;

export function getRiffy() {
  if (riffy) return riffy;

  const spotify = new Spotify({
    clientId: process.env.SPOTIFY_CLIENT_ID || "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || ""
  });

  riffy = new Riffy(
    {}, 
    [{ host, port: parseInt(port), password, secure }],
    {
      send: () => {},
      plugins: [spotify as any],
      bypassChecks: { nodeFetchInfo: true },
      restVersion: "v4"
    }
  );

  return riffy;
}

/**
 * Direct REST Search - much faster and more reliable in Serverless (Vercel)
 * because it doesn't wait for WebSocket handshakes.
 */
export async function searchLavalink(query: string): Promise<LavalinkTrack[]> {
  const protocol = secure ? 'https' : 'http';
  const identifier = query.startsWith("http") ? query : `ytsearch:${query}`;
  const url = `${protocol}://${host}:${port}/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`;

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': password },
      cache: 'no-store'
    });

    if (!response.ok) return [];

    const result = await response.json();

    if (result.loadType === 'search') return result.data;
    if (result.loadType === 'track') return [result.data];
    if (result.loadType === 'playlist') return result.data.tracks;
    
    return [];
  } catch (error) {
    console.error("Lavalink REST Search Error:", error);
    return [];
  }
}

/**
 * Check if Lavalink Node is Online
 */
export async function getLavalinkStatus() {
  const protocol = secure ? 'https' : 'http';
  const url = `${protocol}://${host}:${port}/v4/info`;

  try {
    const start = Date.now();
    const response = await fetch(url, {
      headers: { 'Authorization': password },
      signal: AbortSignal.timeout(5000)
    });
    const latency = Date.now() - start;

    return {
      online: response.ok,
      latency: `${latency}ms`,
      version: response.ok ? (await response.json()).version.semver : 'unknown'
    };
  } catch (error) {
    return { online: false, latency: 'timeout', version: 'unknown' };
  }
}
