'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react';

export default function Player() {
  const { currentTrack, isPlaying, play, pause, resume, next, volume, setVolume } = usePlayerStore();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // We resolve the stream URL on the client
  useEffect(() => {
    if (!currentTrack) {
      setResolvedUrl(null);
      return;
    }

    const resolve = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          setResolvedUrl(data.url);
        } else {
          setResolvedUrl(`/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}`);
        }
      } catch (e) {
        setResolvedUrl(`/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}`);
      } finally {
        setIsLoading(false);
      }
    };

    resolve();
  }, [currentTrack]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLoading) return;
    
    if (isPlaying && resolvedUrl) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn("Playback prevented, waiting for interaction", e);
        });
      }
    } else {
      video.pause();
    }
  }, [isPlaying, resolvedUrl, currentTrack, isLoading]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  const handleEnded = () => {
    next();
  };

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 text-zinc-500 z-50">
        No track playing
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 justify-between z-50">
      {/* Using hidden video instead of audio for better YouTube compatibility */}
      <video
        ref={videoRef}
        src={resolvedUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        className="hidden"
        playsInline
        onError={(e) => {
          const video = videoRef.current;
          console.error("Media error details:", {
            code: video?.error?.code,
            message: video?.error?.message,
          });
          
          if (video?.error?.code === 4 || video?.error?.code === 3) {
            console.warn("Persistent media error, auto-skipping...");
            setTimeout(() => next(), 2000);
          }
        }}
      />
      
      {/* Track Info */}
      <div className="flex items-center w-1/3">
        {currentTrack.info.artworkUrl ? (
          <img src={currentTrack.info.artworkUrl} alt="Cover" className="h-14 w-14 rounded-md mr-4" />
        ) : (
          <div className="h-14 w-14 bg-zinc-800 rounded-md mr-4 flex items-center justify-center">
             🎵
          </div>
        )}
        <div className="overflow-hidden">
          <div className="text-white text-sm font-bold truncate">{currentTrack.info.title}</div>
          <div className="text-zinc-400 text-xs truncate">{currentTrack.info.author}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center w-1/3">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => isPlaying ? pause() : resume()} 
            className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
          <button onClick={next} className="text-zinc-400 hover:text-white transition p-2">
            <SkipForward size={22} fill="currentColor" />
          </button>
        </div>
        <div className="w-full max-w-md mt-2 flex items-center space-x-2">
          <div className="h-1.5 w-full bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)] transition-all duration-300" style={{ width: `${progress || 0}%` }}></div>
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
