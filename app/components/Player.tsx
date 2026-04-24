'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react';

export default function Player() {
  const { currentTrack, isPlaying, play, pause, resume, next, volume, setVolume } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.play().catch(e => console.error("Playback error", e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleEnded = () => {
    next();
  };

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 text-zinc-500">
        No track playing
      </div>
    );
  }

  // Use our proxy for the audio stream
  const streamUrl = `/api/stream?url=${encodeURIComponent(currentTrack.info.uri)}`;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 justify-between z-50">
      <audio
        ref={audioRef}
        src={streamUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      
      {/* Track Info */}
      <div className="flex items-center w-1/3">
        {currentTrack.info.artworkUrl ? (
          <img src={currentTrack.info.artworkUrl} alt="Cover" className="h-14 w-14 rounded-md mr-4" />
        ) : (
          <div className="h-14 w-14 bg-zinc-800 rounded-md mr-4"></div>
        )}
        <div className="overflow-hidden">
          <div className="text-white text-sm font-medium truncate">{currentTrack.info.title}</div>
          <div className="text-zinc-400 text-xs truncate">{currentTrack.info.author}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center w-1/3">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => isPlaying ? pause() : resume()} 
            className="h-8 w-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
          >
            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-1" />}
          </button>
          <button onClick={next} className="text-zinc-400 hover:text-white transition">
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>
        <div className="w-full max-w-md mt-2 flex items-center space-x-2">
          <div className="h-1 w-full bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-white" style={{ width: `${progress || 0}%` }}></div>
          </div>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center w-1/3 justify-end space-x-2">
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
