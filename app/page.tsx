'use client';

import { useState, useEffect } from 'react';
import TikTokLivePanel from './components/TikTokLivePanel';
import Player from './components/Player';
import { LavalinkTrack } from '../lib/lavalink';
import { usePlayerStore } from '../store/playerStore';
import { useBroadcastState } from '../lib/sync';
import { Search, Play, Plus, History, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { play, addToQueue, queue, currentTrack, getTopPlayed, activeUsername } = usePlayerStore();
  
  // Broadcast state to overlays via our API
  useBroadcastState(activeUsername);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LavalinkTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [topPlayed, setTopPlayed] = useState<LavalinkTrack[]>([]);

  useEffect(() => {
    setTopPlayed(getTopPlayed());
  }, [currentTrack]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSearchResults(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderTrackList = (tracks: LavalinkTrack[], title: string, icon?: React.ReactNode) => (
    <div className="bg-zinc-900/50 p-4 lg:p-6 rounded-2xl border border-zinc-800">
      <h2 className="text-lg lg:text-xl font-black mb-4 flex items-center tracking-tight">
        {icon && <span className="mr-3">{icon}</span>}
        {title}
      </h2>
      <div className="space-y-1">
        {tracks.map((track, idx) => (
          <div key={idx} className="flex items-center p-2 lg:p-3 hover:bg-zinc-800 rounded-xl group transition-all">
            {track.info.artworkUrl ? (
              <img src={track.info.artworkUrl} alt="" className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg mr-3 lg:mr-4 object-cover shadow-md" />
            ) : (
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-zinc-800 rounded-lg mr-3 lg:mr-4 flex-shrink-0 shadow-md"></div>
            )}
            <div className="flex-1 overflow-hidden pr-2 lg:pr-4">
              <div className="text-white truncate font-bold text-sm lg:text-[15px]">{track.info.title}</div>
              <div className="text-zinc-400 text-xs lg:text-sm truncate font-medium">{track.info.author}</div>
            </div>
            <div className="text-zinc-500 text-xs lg:text-sm w-12 lg:w-16 font-medium hidden sm:block">{formatTime(track.info.length)}</div>
            <div className="flex space-x-2 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <button 
                onClick={() => play(track)}
                className="p-2 lg:p-2.5 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-lg shadow-white/20"
              >
                <Play size={14} fill="currentColor" className="ml-0.5" />
              </button>
              <button 
                onClick={() => addToQueue(track)}
                className="p-2 lg:p-2.5 border-2 border-zinc-600 text-white rounded-full hover:border-white transition-colors"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-zinc-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))] overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto lg:overflow-hidden p-4 lg:p-8 order-2 lg:order-1 pb-24 lg:pb-0">
        <header className="mb-6 lg:mb-10 flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0 mt-4 lg:mt-0">
          <div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tighter text-white mb-1 lg:mb-2 drop-shadow-sm">Yakisoba DJ</h1>
            <p className="text-zinc-400 font-medium text-sm lg:text-base">TikTok Live Interactive Music Streamer</p>
          </div>
          
          <div className="flex flex-wrap gap-2 lg:space-x-3">
            {activeUsername ? (
              <>
                <Link href={`/overlay/${activeUsername}/chat`} target="_blank" className="flex items-center space-x-2 px-3 py-2 bg-pink-500/10 border border-pink-500/30 rounded-lg hover:bg-pink-500/20 transition-colors text-xs lg:text-sm font-bold text-pink-400">
                  <span>Chat Overlay</span>
                  <ExternalLink size={14} />
                </Link>
                <Link href={`/overlay/${activeUsername}/queue`} target="_blank" className="flex items-center space-x-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg hover:bg-green-500/20 transition-colors text-xs lg:text-sm font-bold text-green-400">
                  <span>Queue Overlay</span>
                  <ExternalLink size={14} />
                </Link>
              </>
            ) : (
              <div className="text-xs text-zinc-500 italic bg-zinc-900/50 px-3 py-2 rounded-lg border border-zinc-800">
                Connect TikTok to get Overlay Links
              </div>
            )}
          </div>
        </header>

        <form onSubmit={handleSearch} className="relative w-full max-w-2xl mb-6 lg:mb-8">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-zinc-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value === '') setSearchResults([]);
            }}
            className="block w-full pl-12 pr-4 py-3 lg:py-4 border-2 border-zinc-800 rounded-2xl leading-5 bg-zinc-900/50 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:bg-zinc-900 transition-all text-base lg:text-lg font-medium shadow-xl"
            placeholder="Search for a song manually..."
          />
        </form>

        <div className="flex-1 lg:overflow-y-auto pr-0 lg:pr-4 pb-4 lg:pb-24">
          {isSearching ? (
            <div className="text-zinc-500 font-bold animate-pulse text-lg">Searching Lavalink...</div>
          ) : searchResults.length > 0 ? (
            renderTrackList(searchResults, "Search Results", <Search size={24} className="text-pink-500" />)
          ) : topPlayed.length > 0 ? (
            renderTrackList(topPlayed, "DJ's Top Played (Local History)", <History size={24} className="text-purple-500" />)
          ) : (
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-8 lg:h-64 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="text-5xl lg:text-6xl drop-shadow-lg mb-2">📻</div>
              <h3 className="text-xl lg:text-2xl font-black text-white">Ready to Stream</h3>
              <p className="text-zinc-400 font-medium max-w-md text-sm lg:text-base">Connect to a TikTok live on the right, or search for songs manually to start building your queue.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - TikTok & Queue */}
      <div className="w-full lg:w-[400px] bg-black border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col h-[60vh] lg:h-full shadow-2xl relative z-10 order-1 lg:order-2 lg:pb-20 flex-shrink-0">
        {/* TikTok Panel */}
        <div className="h-1/2 lg:h-[55%] p-4 lg:p-6 border-b border-zinc-800 flex flex-col bg-zinc-950 overflow-hidden">
          <TikTokLivePanel />
        </div>

        {/* Queue */}
        <div className="h-1/2 lg:h-[45%] p-4 lg:p-6 flex flex-col bg-zinc-900/20 overflow-hidden">
          <h2 className="text-lg lg:text-xl font-black mb-3 lg:mb-4 flex-shrink-0 tracking-tight">Up Next</h2>
          <div className="flex-1 overflow-y-auto space-y-2 lg:space-y-3 pr-2">
            {currentTrack && (
              <div className="p-3 lg:p-4 bg-zinc-800/80 rounded-xl border border-green-500/50 shadow-lg shadow-green-900/20 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                <div className="text-[10px] text-green-400 font-black mb-1 lg:mb-1.5 uppercase tracking-widest flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-ping mr-2"></div>
                  Now Playing
                </div>
                <div className="text-white truncate font-bold text-sm lg:text-base">{currentTrack.info.title}</div>
                <div className="text-zinc-400 text-xs truncate font-medium mt-0.5">{currentTrack.info.author}</div>
              </div>
            )}
            {queue.map((track, idx) => (
              <div key={idx} className="p-2.5 lg:p-3 bg-zinc-900 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors flex items-center">
                <div className="text-zinc-600 font-black text-xs w-6">{idx + 1}</div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-white truncate text-xs lg:text-sm font-bold">{track.info.title}</div>
                  <div className="text-zinc-400 text-[10px] lg:text-xs truncate font-medium">{track.info.author}</div>
                </div>
              </div>
            ))}
            {queue.length === 0 && !currentTrack && (
              <div className="text-zinc-600 text-sm h-full flex flex-col items-center justify-center font-medium py-4">
                <div className="text-2xl lg:text-3xl mb-2 opacity-50">🎧</div>
                Queue is empty
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Global Player for Audio (Only rendered on main Dashboard) */}
      <Player />
    </div>
  );
}
