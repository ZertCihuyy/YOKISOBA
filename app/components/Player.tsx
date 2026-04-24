'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { Play, Pause, SkipForward, Volume2, RefreshCw } from 'lucide-react';

export default function Player() {
  const { currentTrack, isPlaying, play, pause, resume, next, volume, setVolume } = usePlayerStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const lastTimeRef = useRef(0);
  const retryCountRef = useRef(0);

  // Mengambil URL stream
  useEffect(() => {
    if (!currentTrack) {
      setResolvedUrl(null);
      return;
    }

    setIsLoading(true);
    // Tambahkan timestamp untuk menghindari cache agresif saat reconnect
    setResolvedUrl(`/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}&t=${Date.now()}`);
    setTimeout(() => setIsLoading(false), 100);
    lastTimeRef.current = 0;
    retryCountRef.current = 0;
  }, [currentTrack]);

  // Kontrol Play/Pause dan Loading
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLoading || !resolvedUrl) return;
    
    // Paksa browser untuk memuat ulang source setiap kali URL berubah
    video.load();
    
    if (isPlaying) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.warn("Playback prevented", e));
      }
    } else {
      video.pause();
    }
  }, [isPlaying, resolvedUrl, isLoading]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // Fungsi Reconnect Otomatis
  const handleReconnect = useCallback(() => {
    const video = videoRef.current;
    if (!video || !currentTrack) return;

    console.log("🔄 Mencoba menyambung kembali...");
    setIsReconnecting(true);
    
    // Simpan posisi terakhir
    const currentTime = video.currentTime || lastTimeRef.current;
    lastTimeRef.current = currentTime;

    // Refresh URL dengan token baru untuk bypass cache
    setResolvedUrl(`/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}&reconnect=${Date.now()}`);

    // Tunggu sebentar lalu load dan lompat ke waktu terakhir
    const onCanPlay = () => {
      video.currentTime = currentTime;
      if (isPlaying) video.play().catch(() => {});
      setIsReconnecting(false);
      video.removeEventListener('canplay', onCanPlay);
    };

    video.addEventListener('canplay', onCanPlay);
    video.load();
  }, [currentTrack, isPlaying]);

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

    console.error("❌ Media Error:", video.error?.code);

    // Jika error karena masalah jaringan (code 2 atau 4)
    if (retryCountRef.current < 5) {
      retryCountRef.current += 1;
      setTimeout(handleReconnect, 2000);
    } else {
      console.warn("Maksimal percobaan gagal, lanjut lagu berikutnya");
      next();
    }
  };

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 text-zinc-500 z-50">
        Pilih lagu untuk memulai...
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 justify-between z-50">
      <video
        ref={videoRef}
        src={resolvedUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => next()}
        onError={handleError}
        onStalled={handleReconnect} // Trigger jika internet ngadat
        className="hidden"
        playsInline
      />
      
      {/* Track Info */}
      <div className="flex items-center w-1/3">
        {currentTrack.info.artworkUrl ? (
          <img src={currentTrack.info.artworkUrl} alt="Cover" className={`h-14 w-14 rounded-md mr-4 ${isReconnecting ? 'animate-pulse opacity-50' : ''}`} />
        ) : (
          <div className="h-14 w-14 bg-zinc-800 rounded-md mr-4 flex items-center justify-center">🎵</div>
        )}
        <div className="overflow-hidden">
          <div className="text-white text-sm font-bold truncate">
            {isReconnecting && <span className="text-pink-500 mr-2">[Reconnect...]</span>}
            {currentTrack.info.title}
          </div>
          <div className="text-zinc-400 text-xs truncate">{currentTrack.info.author}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center w-1/3">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => isPlaying ? pause() : resume()} 
            className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg disabled:opacity-50"
            disabled={isReconnecting}
          >
            {isReconnecting ? <RefreshCw size={20} className="animate-spin" /> : (isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />)}
          </button>
          <button onClick={next} className="text-zinc-400 hover:text-white transition p-2">
            <SkipForward size={22} fill="currentColor" />
          </button>
        </div>
        <div className="w-full max-w-md mt-2 flex items-center space-x-2">
          <div className="h-1.5 w-full bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)] transition-all duration-300 ${isReconnecting ? 'opacity-30' : ''}`} 
              style={{ width: `${progress || 0}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Volume */}
      <div className="hidden sm:flex items-center w-1/3 justify-end space-x-2">
        <Volume2 size={20} className="text-zinc-400" />
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.01" 
          value={volume} 
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-24 accent-white h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}
