'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { 
  Play, Pause, SkipForward, Volume2, RefreshCw, 
  Settings, Monitor, Layout, Maximize2, Minimize2, 
  ChevronUp, ChevronDown, Clock
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

  // 1. Resolve URL
  useEffect(() => {
    if (!currentTrack || playerMode !== 'normal') {
      setResolvedUrl(null);
      return;
    }
    setIsLoading(true);
    setResolvedUrl(`/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}&v=${Date.now()}`);
    setTimeout(() => setIsLoading(false), 200);
  }, [currentTrack, playerMode]);

  // 2. Media Session API (Untuk Kontrol di Notifikasi HP)
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.info.title,
        artist: currentTrack.info.author,
        artwork: [
          { src: currentTrack.info.artworkUrl || '', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', resume);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('nexttrack', next);
    }
  }, [currentTrack, resume, pause, next]);

  // 3. Playback Control
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLoading || !resolvedUrl) return;
    
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, resolvedUrl, isLoading]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

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
      
      {/* Progress Bar (Global) */}
      <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
        <div className="h-full bg-pink-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="max-w-7xl mx-auto h-full flex items-center px-4 justify-between relative">
        
        {/* Render Audio Engine */}
        {playerMode === 'normal' && (
          <video
            ref={videoRef}
            src={resolvedUrl || undefined}
            onTimeUpdate={handleTimeUpdate}
            onEnded={next}
            className="hidden"
            playsInline
          />
        )}

        {/* LEFT: Info Lagu */}
        <div className="flex items-center w-1/3 overflow-hidden">
          {uiMode !== 'compact' && (
            <div className="relative mr-3 flex-shrink-0">
              <img 
                src={currentTrack.info.artworkUrl || ''} 
                className={`w-14 h-14 rounded-lg object-cover shadow-2xl ${isPlaying ? 'animate-pulse' : ''}`} 
                alt="cover"
              />
            </div>
          )}
          <div className="truncate">
            <h4 className="text-white text-sm font-bold truncate">{currentTrack.info.title}</h4>
            <p className="text-zinc-400 text-xs truncate">{currentTrack.info.author}</p>
          </div>
        </div>

        {/* CENTER: Kontrol Utama */}
        <div className="flex flex-col items-center w-1/3">
          <div className="flex items-center space-x-5">
            <button onClick={() => isPlaying ? pause() : resume()} className="bg-white text-black p-2.5 rounded-full hover:scale-110 transition active:scale-95 shadow-lg">
              {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-0.5" />}
            </button>
            <button onClick={next} className="text-zinc-400 hover:text-white transition">
              <SkipForward size={22} fill="currentColor" />
            </button>
          </div>
          {uiMode === 'standard' && (
            <div className="flex items-center space-x-2 mt-2 text-[10px] text-zinc-500 font-mono">
              <span>{formatTime(currentTime)}</span>
              <div className="w-32 h-1 bg-zinc-800 rounded-full">
                 <div className="h-full bg-zinc-600 rounded-full" style={{ width: `${progress}%` }}></div>
              </div>
              <span>{formatTime(duration || 0)}</span>
            </div>
          )}
        </div>

        {/* RIGHT: Pengaturan & Mode */}
        <div className="flex items-center w-1/3 justify-end space-x-3">
          <div className="hidden md:flex items-center space-x-2 mr-2">
            <Volume2 size={16} className="text-zinc-400" />
            <input 
              type="range" min="0" max="1" step="0.1" value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-16 accent-pink-500 h-1 bg-zinc-800 rounded-lg appearance-none"
            />
          </div>
          
          <div className="flex bg-zinc-800/50 p-1 rounded-lg">
            <button onClick={() => setUiMode('compact')} className={`p-1.5 rounded ${uiMode === 'compact' ? 'bg-pink-500 text-white' : 'text-zinc-500'}`} title="Compact Mode">
              <Minimize2 size={16} />
            </button>
            <button onClick={() => setUiMode('standard')} className={`p-1.5 rounded ${uiMode === 'standard' ? 'bg-pink-500 text-white' : 'text-zinc-500'}`} title="Standard Mode">
              <Layout size={16} />
            </button>
            <button onClick={() => setUiMode('theater')} className={`p-1.5 rounded ${uiMode === 'theater' ? 'bg-pink-500 text-white' : 'text-zinc-500'}`} title="Theater Mode">
              <Monitor size={16} />
            </button>
          </div>

          <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full ${showSettings ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* THEATER MODE / EMBED PANEL */}
      {uiMode === 'theater' && (
        <div className={`absolute bottom-full right-4 mb-4 transition-all duration-500 ${isEmbedVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl w-80">
            <div className="bg-zinc-800 px-3 py-2 flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">YouTube Engine</span>
              <button onClick={() => setIsEmbedVisible(false)} className="text-zinc-400 hover:text-white">
                <ChevronDown size={16} />
              </button>
            </div>
            <div className="aspect-video bg-black">
              {playerMode === 'embed' ? (
                <iframe src={embedUrl} className="w-full h-full" allow="autoplay; encrypted-media" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-[10px] text-center p-4">
                  <Monitor size={24} className="mb-2 opacity-20" />
                  Ganti ke Mode Embed di Settings untuk melihat Video
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Button to show embed if hidden */}
      {uiMode === 'theater' && !isEmbedVisible && (
        <button 
          onClick={() => setIsEmbedVisible(true)}
          className="absolute bottom-full right-4 mb-4 bg-pink-500 text-white p-3 rounded-full shadow-lg animate-bounce"
        >
          <ChevronUp size={20} />
        </button>
      )}

      {/* SETTINGS MENU */}
      {showSettings && (
        <div className="absolute bottom-full right-4 mb-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-2xl w-64 z-[60]">
          <h3 className="text-white font-bold mb-3 text-xs uppercase tracking-tighter">Engine Selection</h3>
          <div className="space-y-2">
            <button 
              onClick={() => setPlayerMode('normal')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs ${playerMode === 'normal' ? 'bg-pink-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}
            >
              <span>Normal (Auto Play)</span>
              {playerMode === 'normal' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
            </button>
            <button 
              onClick={() => setPlayerMode('embed')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs ${playerMode === 'embed' ? 'bg-pink-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}
            >
              <span>Embed (Stabil/Video)</span>
              {playerMode === 'embed' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-800">
             <p className="text-[10px] text-zinc-500 leading-tight">
               *Mode Normal mendukung background play.<br/>
               *Mode Theater mendukung tampilan video.
             </p>
          </div>
        </div>
      )}
    </div>
  );
}
