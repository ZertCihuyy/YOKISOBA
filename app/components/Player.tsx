'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { Play, Pause, SkipForward, Volume2, RefreshCw, AlertCircle, ExternalLink, Settings, Youtube } from 'lucide-react';

export default function Player() {
  const { 
    currentTrack, isPlaying, play, pause, resume, next, 
    volume, setVolume, playerMode, setPlayerMode 
  } = usePlayerStore();
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const lastTimeRef = useRef(0);
  const retryCountRef = useRef(0);

  // 1. Resolve URL & Reset States
  useEffect(() => {
    if (!currentTrack) {
      setResolvedUrl(null);
      setErrorMessage(null);
      return;
    }

    if (playerMode === 'normal') {
      setIsLoading(true);
      setErrorMessage(null);
      setNeedsInteraction(false);
      
      const streamUrl = `/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}&v=${Date.now()}`;
      setResolvedUrl(streamUrl);
      
      setTimeout(() => setIsLoading(false), 200);
    } else {
      // Embed Mode logic handled in render
      setResolvedUrl(null);
      setErrorMessage(null);
      setIsLoading(false);
    }
    
    lastTimeRef.current = 0;
    retryCountRef.current = 0;
  }, [currentTrack, playerMode]);

  // 2. Playback Control (Normal Mode Only)
  useEffect(() => {
    if (playerMode !== 'normal') return;
    const video = videoRef.current;
    if (!video || isLoading || !resolvedUrl) return;
    
    if (isPlaying) {
      video.play().catch(err => {
        if (err.name === 'NotAllowedError') {
          setNeedsInteraction(true);
        } else {
          setErrorMessage("Gagal memutar audio");
        }
      });
    } else {
      video.pause();
    }
  }, [isPlaying, resolvedUrl, isLoading, playerMode]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // 3. Reconnect Logic (Normal Mode Only)
  const handleReconnect = useCallback(() => {
    if (playerMode !== 'normal') return;
    const video = videoRef.current;
    if (!video || !currentTrack || retryCountRef.current >= 5) {
      if (retryCountRef.current >= 5) setErrorMessage("Koneksi gagal.");
      return;
    }

    setIsReconnecting(true);
    const currentTime = video.currentTime || lastTimeRef.current;
    lastTimeRef.current = currentTime;

    const newUrl = `/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}&retry=${Date.now()}`;
    setResolvedUrl(newUrl);

    const onCanPlay = () => {
      video.currentTime = currentTime;
      video.play().catch(() => setNeedsInteraction(true));
      setIsReconnecting(false);
      setErrorMessage(null);
      video.removeEventListener('canplay', onCanPlay);
    };

    video.addEventListener('canplay', onCanPlay);
    video.load();
    retryCountRef.current += 1;
  }, [currentTrack, playerMode]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.currentTime > 0) {
      setProgress((video.currentTime / video.duration) * 100);
      lastTimeRef.current = video.currentTime;
    }
  };

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800 flex items-center px-4 text-zinc-500 z-50">
        Pilih lagu dari playlist...
      </div>
    );
  }

  const embedUrl = `https://www.youtube-nocookie.com/embed/${currentTrack.info.identifier}?autoplay=1&modestbranding=1&rel=0`;

  return (
    <div className="fixed bottom-0 left-0 right-0 min-h-[6rem] bg-black/95 backdrop-blur-xl border-t border-zinc-800 flex flex-col items-center z-50">
      
      {/* Mode Settings Overlay */}
      {showSettings && (
        <div className="absolute bottom-24 right-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-2xl z-[60] w-64">
          <h3 className="text-white font-bold mb-3 text-sm">Pengaturan Player</h3>
          <div className="space-y-2">
            <button 
              onClick={() => { setPlayerMode('normal'); setShowSettings(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${playerMode === 'normal' ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              <span>Mode Normal (Streaming)</span>
              {playerMode === 'normal' && <div className="w-2 h-2 bg-white rounded-full"></div>}
            </button>
            <button 
              onClick={() => { setPlayerMode('embed'); setShowSettings(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${playerMode === 'embed' ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              <span>Mode Embed (YouTube Player)</span>
              {playerMode === 'embed' && <div className="w-2 h-2 bg-white rounded-full"></div>}
            </button>
          </div>
          <p className="mt-3 text-[10px] text-zinc-500 leading-tight">
            *Mode Embed lebih stabil tapi mungkin memerlukan klik manual pada video untuk mulai memutar.
          </p>
        </div>
      )}

      {/* Main Player UI */}
      <div className="w-full h-full flex flex-col sm:flex-row items-center px-4 py-2 justify-between">
        
        {/* Hidden/Embed Element */}
        {playerMode === 'normal' ? (
          <video
            ref={videoRef}
            src={resolvedUrl || undefined}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => next()}
            onError={() => setTimeout(handleReconnect, 3000)}
            onStalled={handleReconnect}
            className="hidden"
            playsInline
          />
        ) : (
          <div className="fixed -top-full left-0 opacity-0 pointer-events-none">
            {/* We keep embed hidden but present for audio if needed, 
                though embed mode usually needs to be visible to be interacted with */}
          </div>
        )}

        {/* Track Info */}
        <div className="flex items-center w-full sm:w-1/3">
          <div className="relative group">
            {currentTrack.info.artworkUrl ? (
              <img src={currentTrack.info.artworkUrl} alt="Cover" className="h-12 w-12 sm:h-14 sm:w-14 rounded-md mr-3 object-cover shadow-lg" />
            ) : (
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-zinc-800 rounded-md mr-3 flex items-center justify-center">🎵</div>
            )}
            {isReconnecting && <RefreshCw size={16} className="absolute inset-0 m-auto text-white animate-spin" />}
          </div>
          
          <div className="overflow-hidden flex-1">
            <div className="text-white text-sm font-bold truncate flex items-center">
              {currentTrack.info.title}
              <a href={currentTrack.info.uri} target="_blank" rel="noopener noreferrer" className="ml-2 text-zinc-500 hover:text-white">
                <ExternalLink size={12} />
              </a>
            </div>
            <div className="text-zinc-400 text-xs truncate">
              {playerMode === 'embed' ? (
                <span className="text-pink-400 flex items-center"><Youtube size={10} className="mr-1" /> Mode Embed Aktif</span>
              ) : (
                errorMessage ? <span className="text-red-400">{errorMessage}</span> : currentTrack.info.author
              )}
            </div>
          </div>
        </div>

        {/* Center Controls & Special Embed UI */}
        <div className="flex flex-col items-center w-full sm:w-1/3 my-2 sm:my-0">
          {playerMode === 'embed' ? (
            <div className="flex flex-col items-center">
               <div className="w-full max-w-[320px] aspect-video mb-2 bg-black rounded-lg overflow-hidden border border-zinc-800">
                  <iframe 
                    src={embedUrl}
                    className="w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  ></iframe>
               </div>
               <div className="flex items-center space-x-4">
                  <button onClick={next} className="bg-zinc-800 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center">
                    Skip Lagu <SkipForward size={14} className="ml-2" />
                  </button>
               </div>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-6">
                <button 
                  onClick={() => isPlaying ? pause() : resume()} 
                  className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition shadow-xl ${needsInteraction ? 'bg-pink-500 text-white animate-bounce' : 'bg-white text-black hover:scale-105'}`}
                >
                  {isReconnecting ? <RefreshCw size={20} className="animate-spin" /> : (isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />)}
                </button>
                <button onClick={next} className="text-zinc-400 hover:text-white transition p-2">
                  <SkipForward size={24} fill="currentColor" />
                </button>
              </div>
              <div className="hidden sm:flex w-full max-w-md mt-2 items-center space-x-2">
                <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-pink-500" style={{ width: `${progress || 0}%` }}></div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Section: Volume & Settings */}
        <div className="flex items-center w-full sm:w-1/3 justify-end space-x-4">
          <div className="hidden sm:flex items-center space-x-2">
            <Volume2 size={18} className="text-zinc-400" />
            <input 
              type="range" min="0" max="1" step="0.01" value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 accent-pink-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition ${showSettings ? 'bg-pink-500 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
