'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { 
  Play, Pause, SkipForward, RefreshCw, 
  Settings, Monitor, Layout, Minimize2, 
  ChevronDown
} from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function Player() {
  const { 
    currentTrack, isPlaying, pause, resume, next, 
    uiMode, setUiMode
  } = usePlayerStore();
  
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isEmbedVisible, setIsEmbedVisible] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement | null>(null);
  const loadingTimerRef = useRef<number | null>(null);
  const pendingPlayRef = useRef(false);
  const pendingVideoIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadingTimerRef.current) {
      window.clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }

    if (!currentTrack) {
      setCurrentVideoId(null);
      setIsLoading(false);
      return;
    }

    setCurrentVideoId(currentTrack.info.identifier);
    setIsLoading(true);
  }, [currentTrack]);

  // Handle playback error
  const handlePlaybackError = () => {
    console.warn('YouTube player error');
  };

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

  // Load YouTube API
  useEffect(() => {
    if (!window.YT) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);

      window.onYouTubeIframeAPIReady = () => {
        if (!playerRef.current && videoRef.current) {
          playerRef.current = new window.YT.Player(videoRef.current, {
            height: '100%',
            width: '100%',
            videoId: currentVideoId || undefined,
            playerVars: {
              autoplay: 0,
              controls: 1,
              modestbranding: 1,
              rel: 0,
            },
            events: {
              onReady: (event: any) => {
                setPlayerReady(true);
                setIsLoading(false);
                if (loadingTimerRef.current) {
                  window.clearTimeout(loadingTimerRef.current);
                  loadingTimerRef.current = null;
                }
                if (pendingVideoIdRef.current && typeof event.target.loadVideoById === 'function') {
                  event.target.loadVideoById(pendingVideoIdRef.current);
                  pendingVideoIdRef.current = null;
                }
                if (pendingPlayRef.current && typeof event.target.playVideo === 'function') {
                  event.target.playVideo();
                  pendingPlayRef.current = false;
                }
              },
              onStateChange: (event: any) => {
                if (event.data === window.YT.PlayerState.PLAYING) {
                  setPlayerReady(true);
                  setIsLoading(false);
                  if (loadingTimerRef.current) {
                    window.clearTimeout(loadingTimerRef.current);
                    loadingTimerRef.current = null;
                  }
                }
              },
            },
          });
        }
      };
    } else if (window.YT && window.YT.Player && !playerRef.current && videoRef.current) {
      playerRef.current = new window.YT.Player(videoRef.current, {
        height: '100%',
        width: '100%',
        videoId: currentVideoId || undefined,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (event: any) => {
            setPlayerReady(true);
            setIsLoading(false);
            if (loadingTimerRef.current) {
              window.clearTimeout(loadingTimerRef.current);
              loadingTimerRef.current = null;
            }
            if (pendingPlayRef.current && typeof event.target.playVideo === 'function') {
              event.target.playVideo();
              pendingPlayRef.current = false;
            }
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setPlayerReady(true);
              setIsLoading(false);
              if (loadingTimerRef.current) {
                window.clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
              }
            }
          },
        },
      });
    }
  }, [currentVideoId]);

  useEffect(() => {
    if (!playerRef.current || !currentVideoId) return;

    try {
      const playerInstance = playerRef.current;
      const currentId = typeof playerInstance.getVideoData === 'function' ? playerInstance.getVideoData().video_id : null;

      if (playerReady) {
        if (currentId !== currentVideoId && typeof playerInstance.loadVideoById === 'function') {
          playerInstance.loadVideoById(currentVideoId);
        }

        if (isPlaying && typeof playerInstance.playVideo === 'function') {
          playerInstance.playVideo();
        } else if (!isPlaying && typeof playerInstance.pauseVideo === 'function') {
          playerInstance.pauseVideo();
        }
      } else {
        pendingVideoIdRef.current = currentVideoId;
        pendingPlayRef.current = isPlaying;
      }

      if (loadingTimerRef.current) {
        window.clearTimeout(loadingTimerRef.current);
      }
      loadingTimerRef.current = window.setTimeout(() => {
        setIsLoading(false);
        loadingTimerRef.current = null;
      }, 2000);
    } catch (e) {
      console.error('Playback control error:', e);
    }
  }, [isPlaying, currentVideoId, playerReady]);

  // const handleTimeUpdate = () => {
  //   const video = videoRef.current;
  //   if (video) {
  //     setProgress((video.currentTime / video.duration) * 100);
  //     setCurrentTime(video.currentTime);
  //   }
  // };

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
        
        {/* Hidden Engine - YouTube Player */}
        <div
          ref={videoRef}
          id="youtube-player"
          className="absolute w-0 h-0 opacity-0 pointer-events-none overflow-hidden"
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        />

        {/* LEFT: Info */}
        <div className="flex items-center w-1/3 overflow-hidden">
          {uiMode !== 'compact' && (
            <div className="relative flex-shrink-0">
              <img src={currentTrack.info.artworkUrl || ''} className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover mr-3 shadow-lg" alt="c" />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg mr-3 backdrop-blur-[2px]">
                  <RefreshCw className="text-white animate-spin" size={20} />
                </div>
              )}
            </div>
          )}
          <div className="truncate">
            <h4 className="text-white text-xs sm:text-sm font-bold truncate">{currentTrack.info.title}</h4>
            <p className="text-zinc-500 text-[10px] sm:text-xs truncate font-medium flex items-center">
              {currentTrack.info.author}
            </p>
          </div>
        </div>

        {/* CENTER: Controls */}
        <div className="flex flex-col items-center w-1/3">
          <div className="flex items-center space-x-5">
            <button onClick={() => isPlaying ? pause() : resume()} className="bg-white text-black p-2 rounded-full hover:scale-110 active:scale-95 transition shadow-lg shadow-white/10">
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
        </div>
      </div>

      {/* THEATER MODE PANEL */}
      {uiMode === 'theater' && (
        <div className={`absolute bottom-full right-4 mb-4 transition-all ${isEmbedVisible ? 'scale-100 opacity-100' : 'scale-50 opacity-0 pointer-events-none'}`}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl w-80">
            <div className="bg-zinc-800 px-3 py-1 flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-400">NATIVE PLAYER</span>
              <button onClick={() => setIsEmbedVisible(!isEmbedVisible)} className="text-zinc-400"><ChevronDown size={14}/></button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center relative">
              {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                  <RefreshCw className="text-pink-500 animate-spin mb-2" size={24} />
                  <span className="text-xs text-zinc-400 font-bold">Buffering Stream...</span>
                </div>
              ) : null}
              <iframe src={embedUrl} className="w-full h-full opacity-50 pointer-events-none" allow="autoplay; encrypted-media" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
