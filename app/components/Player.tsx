'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { 
  Play, Pause, SkipForward, Volume2, RefreshCw, 
  Settings, Monitor, Layout, Minimize2, 
  ChevronUp, ChevronDown, Music, Video, Radio
} from 'lucide-react';

export default function Player() {
  const { 
    currentTrack, isPlaying, pause, resume, next, 
    volume, setVolume, playerMode, setPlayerMode,
    uiMode, setUiMode
  } = usePlayerStore();
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isEmbedVisible, setIsEmbedVisible] = useState(true);

  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  // Resolve URL berdasarkan mode
  useEffect(() => {
    if (!currentTrack) {
      setResolvedUrl(null);
      return;
    }

    if (playerMode === 'normal' || playerMode === 'lavalink') {
      // Prioritaskan streaming proxy kita
      const trackUrl = currentTrack.info.uri;
      setResolvedUrl(`/api/stream?url=${encodeURIComponent(trackUrl)}&v=${Date.now()}`);
    } else {
      setResolvedUrl(null); // Embed mode handled by iframe
    }
    // Reset retry count saat lagu ganti
    setRetryCount(0);
  }, [currentTrack, playerMode]);

  // Handle Playback Error & Auto Reconnect
  const handlePlaybackError = useCallback(() => {
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.warn(`Playback error, retrying in ${delay}ms... (Attempt ${retryCount + 1}/${maxRetries})`);
      setIsLoading(true);
      
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        // Force refresh URL to bypass cache/expired links
        if (currentTrack) {
           setResolvedUrl(`/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}&v=${Date.now() + retryCount}`);
        }
      }, delay);
    } else {
      console.error("Max retries reached. Moving to next track.");
      next();
    }
  }, [retryCount, currentTrack, next]);

  // Media Session Control
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.info.title,
        artist: currentTrack.info.author,
        artwork: [{ src: currentTrack.info.artworkUrl || '', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.setActionHandler('play', resume);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('nexttrack', next);
    }
  }, [currentTrack, resume, pause, next]);

  // Playback Logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedUrl) return;
    
    if (isPlaying) {
      video.play().then(() => {
        setIsLoading(false);
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          handlePlaybackError();
        }
      });
    } else {
      video.pause();
    }
  }, [isPlaying, resolvedUrl, handlePlaybackError]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setProgress((video.currentTime / video.duration) * 100);
      setCurrentTime(video.currentTime);
      setDuration(video.duration);
    }
  };

  if (!currentTrack) return null;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${currentTrack.info.identifier}?autoplay=1&modestbranding=1`;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-500 ${
      uiMode === 'compact' ? 'h-14 bg-black/80' : 'h-24 bg-zinc-900/95'
    } backdrop-blur-xl border-t border-zinc-800`}>
      
      <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
        <div className={`h-full transition-all duration-300 ${isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-pink-500'}`} style={{ width: `${progress}%` }}></div>
      </div>

      <div className="max-w-7xl mx-auto h-full flex items-center px-4 justify-between relative">
        
        {/* Hidden Engine (Normal & Lavalink) */}
        {(playerMode === 'normal' || playerMode === 'lavalink') && (
          <video
            ref={videoRef}
            src={resolvedUrl || undefined}
            onTimeUpdate={handleTimeUpdate}
            onEnded={next}
            onError={handlePlaybackError}
            onLoadStart={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)}
            className="hidden"
            playsInline
          />
        )}

        {/* LEFT: Info */}
        <div className="flex items-center w-1/3 overflow-hidden">
          {uiMode !== 'compact' && (
            <div className="relative">
              <img src={currentTrack.info.artworkUrl || ''} className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover mr-3 shadow-lg" alt="c" />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg mr-3">
                  <RefreshCw className="text-white animate-spin" size={20} />
                </div>
              )}
            </div>
          )}
          <div className="truncate">
            <h4 className="text-white text-xs sm:text-sm font-bold truncate">{currentTrack.info.title}</h4>
            <p className="text-zinc-500 text-[10px] sm:text-xs truncate font-medium">
              {retryCount > 0 ? `🔄 Reconnecting (${retryCount})...` : (playerMode === 'lavalink' ? '📡 Lavalink Mode' : currentTrack.info.author)}
            </p>
          </div>
        </div>

        {/* CENTER: Controls */}
        <div className="flex flex-col items-center w-1/3">
          <div className="flex items-center space-x-5">
            <button onClick={() => isPlaying ? pause() : resume()} className="bg-white text-black p-2 rounded-full hover:scale-110 active:scale-95 transition">
              {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-0.5" />}
            </button>
            <button onClick={next} className="text-zinc-400 hover:text-white transition">
              <SkipForward size={22} fill="currentColor" />
            </button>
          </div>
        </div>

        {/* RIGHT: Settings */}
        <div className="flex items-center w-1/3 justify-end space-x-2 sm:space-x-4">
          <div className="flex bg-zinc-800/50 p-1 rounded-lg">
            <button onClick={() => setUiMode('compact')} className={`p-1.5 rounded ${uiMode === 'compact' ? 'bg-pink-500 text-white' : 'text-zinc-500'}`}><Minimize2 size={14} /></button>
            <button onClick={() => setUiMode('standard')} className={`p-1.5 rounded ${uiMode === 'standard' ? 'bg-pink-500 text-white' : 'text-zinc-500'}`}><Layout size={14} /></button>
            <button onClick={() => setUiMode('theater')} className={`p-1.5 rounded ${uiMode === 'theater' ? 'bg-pink-500 text-white' : 'text-zinc-500'}`}><Monitor size={14} /></button>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full ${showSettings ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* THEATER MODE PANEL */}
      {uiMode === 'theater' && (
        <div className={`absolute bottom-full right-4 mb-4 transition-all ${isEmbedVisible ? 'scale-100 opacity-100' : 'scale-50 opacity-0 pointer-events-none'}`}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl w-80">
            <div className="bg-zinc-800 px-3 py-1 flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-400">ENGINE: {playerMode.toUpperCase()}</span>
              <button onClick={() => setIsEmbedVisible(false)} className="text-zinc-400"><ChevronDown size={14}/></button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              {playerMode === 'embed' ? (
                <iframe src={embedUrl} className="w-full h-full" allow="autoplay; encrypted-media" />
              ) : (
                <div className="text-[10px] text-zinc-600 p-4 text-center">Ganti ke Mode Embed untuk melihat Video</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MENU */}
      {showSettings && (
        <div className="absolute bottom-full right-4 mb-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-2xl w-64 z-[60]">
          <h3 className="text-white font-bold mb-3 text-[10px] uppercase">Pilih Mode Pemutar (Backup)</h3>
          <div className="space-y-2">
            <button onClick={() => setPlayerMode('normal')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs ${playerMode === 'normal' ? 'bg-pink-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              <Radio size={14} /> <span>Normal (Streaming)</span>
            </button>
            <button onClick={() => setPlayerMode('embed')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs ${playerMode === 'embed' ? 'bg-pink-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              <Video size={14} /> <span>Embed (Youtube Iframe)</span>
            </button>
            <button onClick={() => setPlayerMode('lavalink')} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs ${playerMode === 'lavalink' ? 'bg-pink-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              <Music size={14} /> <span>Lavalink (Backup 3)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
