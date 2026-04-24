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

export interface PlayerState {
  currentTrack: LavalinkTrack | null;
  queue: LavalinkTrack[];
  isPlaying: boolean;
  volume: number;
  history: Record<string, any>;
  chat: ChatMessage[];
  status: string;
  activeUsername: string;
  viewerCount: number;
  playerMode: 'normal' | 'embed';
  uiMode: 'compact' | 'standard' | 'theater';
  
  play: (track: LavalinkTrack) => void;
  pause: () => void;
  resume: () => void;
  addToQueue: (track: LavalinkTrack) => void;
  next: () => void;
  setVolume: (volume: number) => void;
  setStatus: (status: string) => void;
  setActiveUsername: (username: string) => void;
  setViewerCount: (count: number) => void;
  setPlayerMode: (mode: 'normal' | 'embed') => void;
  setUiMode: (mode: 'compact' | 'standard' | 'theater') => void;
  addChat: (msg: ChatMessage) => void;
  clearChat: () => void;
  getTopPlayed: () => LavalinkTrack[];
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
      uiMode: 'standard',

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
          return { currentTrack: track, isPlaying: true, queue: [] };
        }
        return { queue: [...state.queue, track] };
      }),

      next: () => set((state) => {
        if (state.queue.length === 0) return { currentTrack: null, isPlaying: false };
        const [nextTrack, ...rest] = state.queue;
        return { currentTrack: nextTrack, queue: rest, isPlaying: true };
      }),

      setVolume: (volume) => set({ volume }),
      setStatus: (status) => set({ status }),
      setActiveUsername: (username) => set({ activeUsername: username }),
      setViewerCount: (viewerCount) => set({ viewerCount }),
      setPlayerMode: (playerMode) => set({ playerMode }),
      setUiMode: (uiMode) => set({ uiMode }),
      
      addChat: (msg) => set((state) => ({ 
        chat: [...state.chat, msg].slice(-100) 
      })),
      
      clearChat: () => set({ chat: [] }),

      getTopPlayed: () => {
        const { history } = get();
        return Object.values(history)
          .sort((a: any, b: any) => b.playCount - a.playCount)
          .slice(0, 10)
          .map((h: any) => h.track);
      },
    }),
    {
      name: 'yakisoba-player-storage',
      partialize: (state) => ({ 
        volume: state.volume, 
        activeUsername: state.activeUsername,
        playerMode: state.playerMode,
        uiMode: state.uiMode,
        history: state.history
      }),
    }
  )
);
