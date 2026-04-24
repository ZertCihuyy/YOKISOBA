'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { Play, Pause, SkipForward, Volume2, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';

export default function Player() {
  const { currentTrack, isPlaying, play, pause, resume, next, volume, setVolume } = usePlayerStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const [progress, setProgress] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  const lastTimeRef = useRef(0);
  const retryCountRef = useRef(0);

  // 1. Resolve URL & Reset States
  useEffect(() => {
    if (!currentTrack) {
      setResolvedUrl(null);
      setErrorMessage(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setNeedsInteraction(false);
    
    const streamUrl = `/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}&v=${Date.now()}`;
    setResolvedUrl(streamUrl);
    
    setTimeout(() => setIsLoading(false), 200);
    lastTimeRef.current = 0;
    retryCountRef.current = 0;
  }, [currentTrack]);

  // 2. Playback Control
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLoading || !resolvedUrl) return;
    
    if (isPlaying) {
      video.play().catch(err => {
        if (err.name === 'NotAllowedError') {
          console.warn("Autoplay blocked");
          setNeedsInteraction(true);
        } else {
          setErrorMessage("Gagal memutar audio");
        }
      });
    } else {
      video.pause();
    }
  }, [isPlaying, resolvedUrl, isLoading]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // 3. Reconnect Logic
  const handleReconnect = useCallback(() => {
    const video = videoRef.current;
    if (!video || !currentTrack || retryCountRef.current >= 5) {
      if (retryCountRef.current >= 5) setErrorMessage("Koneksi gagal setelah 5 kali coba.");
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
  }, [currentTrack]);

  // 4. Event Handlers
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.currentTime > 0) {
      setProgress((video.currentTime / video.duration) * 100);
      lastTimeRef.current = video.currentTime;
    }
  };

  const handleError = () => {
    const video = videoRef.current;
    if (!video) return;

    const error = video.error;
    let msg = "Terjadi kesalahan media";
    
    if (error?.code === 1) msg = "Proses aborsi oleh pengguna";
    if (error?.code === 2) msg = "Masalah jaringan (Internet Lemot)";
    if (error?.code === 3) msg = "Dekode audio gagal (Format Salah)";
    if (error?.code === 4) msg = "Sumber audio tidak didukung/ditemukan";

    setErrorMessage(msg);
    console.error("❌ Player Error:", msg, error);

    if (error?.code !== 1) {
      setTimeout(handleReconnect, 3000);
    }
  };

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800 flex items-center px-4 text-zinc-500 z-50">
        Pilih lagu dari playlist...
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 sm:h-20 bg-black/90 backdrop-blur-xl border-t border-zinc-800 flex flex-col sm:flex-row items-center px-4 justify-between z-50">
      <video
        ref={videoRef}
        src={resolvedUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => next()}
        onError={handleError}
        onStalled={handleReconnect}
        className="hidden"
        playsInline
      />
      
      {/* progress bar top (mobile) */}
      <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800 sm:hidden">
         <div className="h-full bg-pink-500 transition-all duration-300" style={{ width: `${progress || 0}%` }}></div>
      </div>

      {/* Track Info */}
      <div className="flex items-center w-full sm:w-1/3 mt-2 sm:mt-0">
        <div className="relative group">
          {currentTrack.info.artworkUrl ? (
            <img src={currentTrack.info.artworkUrl} alt="Cover" className={`h-12 w-12 sm:h-14 sm:w-14 rounded-md mr-3 object-cover shadow-lg ${isReconnecting ? 'animate-pulse opacity-50' : ''}`} />
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
          <div className="text-zinc-400 text-xs truncate flex items-center">
            {errorMessage ? (
              <span className="text-red-400 flex items-center">
                <AlertCircle size={10} className="mr-1" /> {errorMessage}
              </span>
            ) : (
              currentTrack.info.author
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center w-full sm:w-1/3 my-1 sm:my-0">
        <div className="flex items-center space-x-6">
          <button 
            onClick={() => isPlaying ? pause() : resume()} 
            className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition shadow-xl active:scale-95 ${needsInteraction ? 'bg-pink-500 text-white animate-bounce' : 'bg-white text-black hover:scale-105'}`}
          >
            {isReconnecting ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : needsInteraction ? (
              <Play size={24} fill="currentColor" className="ml-1" />
            ) : isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" className="ml-1" />
            )}
          </button>
          <button onClick={next} className="text-zinc-400 hover:text-white transition p-2 active:scale-90">
            <SkipForward size={24} fill="currentColor" />
          </button>
        </div>
        
        {/* Progress Bar (Desktop) */}
        <div className="hidden sm:flex w-full max-w-md mt-2 items-center space-x-2">
          <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden cursor-pointer">
            <div 
              className={`h-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.6)] transition-all duration-300 ${isReconnecting ? 'opacity-30' : ''}`} 
              style={{ width: `${progress || 0}%` }}
            ></div>
          </div>
        </div>

        {needsInteraction && (
          <span className="text-[10px] text-pink-500 font-bold uppercase tracking-tighter mt-1 animate-pulse">
            Klik Tombol Play untuk Memulai
          </span>
        )}
      </div>

      {/* Volume & Extra */}
      <div className="hidden sm:flex items-center w-1/3 justify-end space-x-3">
        <Volume2 size={18} className="text-zinc-400" />
        <input 
          type="range" min="0" max="1" step="0.01" value={volume} 
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-20 accent-pink-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}
