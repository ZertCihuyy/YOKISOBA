import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LavalinkTrack } from '../lib/lavalink';

export interface ChatMessage {
  user: string;
  nickname: string;
  avatar: string;
  comment: string;
  isCommand: boolean;
  type: 'chat' | 'gift' | 'member' | 'like' | 'sticker';
  giftData?: {
    name: string;
    count: number;
    image: string;
  };
}

export interface PlayHistory {
  track: LavalinkTrack;
  playCount: number;
  lastPlayed: number;
}

export interface PlayerState {
  currentTrack: LavalinkTrack | null;
  queue: LavalinkTrack[];
  isPlaying: boolean;
  volume: number;
  history: Record<string, PlayHistory>;
  chat: ChatMessage[];
  status: 'Disconnected' | 'Connecting...' | 'Connected' | 'Reconnecting...';
  activeUsername: string;
  viewerCount: number;
  playerMode: 'normal' | 'embed';
  
  play: (track: LavalinkTrack) => void;
  pause: () => void;
  resume: () => void;
  addToQueue: (track: LavalinkTrack) => void;
  next: () => void;
  setVolume: (volume: number) => void;
  getTopPlayed: () => LavalinkTrack[];
  addChat: (msg: ChatMessage) => void;
  setStatus: (status: 'Disconnected' | 'Connecting...' | 'Connected' | 'Reconnecting...') => void;
  clearChat: () => void;
  setActiveUsername: (username: string) => void;
  setViewerCount: (count: number) => void;
  setPlayerMode: (mode: 'normal' | 'embed') => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      isPlaying: false,
      volume: 1,
      history: {},
      chat: [],
      status: 'Disconnected',
      activeUsername: '',
      viewerCount: 0,
      playerMode: 'normal',

      play: (track) => set((state) => {
        const history = { ...state.history };
        const id = track.info.identifier;
        if (history[id]) {
          history[id].playCount += 1;
          history[id].lastPlayed = Date.now();
        } else {
          history[id] = { track, playCount: 1, lastPlayed: Date.now() };
        }
        return { currentTrack: track, isPlaying: true, history };
      }),

      pause: () => set({ isPlaying: false }),
      resume: () => set({ isPlaying: true }),

      addToQueue: (track) => set((state) => {
        if (!state.currentTrack) {
          const history = { ...state.history };
          const id = track.info.identifier;
          if (history[id]) {
            history[id].playCount += 1;
            history[id].lastPlayed = Date.now();
          } else {
            history[id] = { track, playCount: 1, lastPlayed: Date.now() };
          }
          return { currentTrack: track, isPlaying: true, queue: [], history };
        }
        return { queue: [...state.queue, track] };
      }),

      next: () => set((state) => {
        if (state.queue.length === 0) {
          return { currentTrack: null, isPlaying: false };
        }
        const [nextTrack, ...remainingQueue] = state.queue;
        
        const history = { ...state.history };
        const id = nextTrack.info.identifier;
        if (history[id]) {
          history[id].playCount += 1;
          history[id].lastPlayed = Date.now();
        } else {
          history[id] = { track: nextTrack, playCount: 1, lastPlayed: Date.now() };
        }

        return { currentTrack: nextTrack, queue: remainingQueue, isPlaying: true, history };
      }),

      setVolume: (volume) => set({ volume }),

      getTopPlayed: () => {
        const { history } = get();
        return Object.values(history)
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 10)
          .map(h => h.track);
      },
      
      addChat: (msg) => set((state) => ({ 
        chat: [...state.chat, msg].slice(-100) 
      })),
      
      setStatus: (status) => set({ status }),
      
      clearChat: () => set({ chat: [] }),

      setActiveUsername: (username) => set({ activeUsername: username }),
      
      setViewerCount: (viewerCount) => set({ viewerCount }),

      setPlayerMode: (playerMode) => set({ playerMode }),
    }),
    {
      name: 'yakisoba-player-storage',
      partialize: (state) => ({ 
        history: state.history, 
        volume: state.volume, 
        activeUsername: state.activeUsername,
        playerMode: state.playerMode
      }),
    }
  )
);
