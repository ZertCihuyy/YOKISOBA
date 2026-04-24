import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LavalinkTrack } from '../lib/lavalink';

export interface PlayerState {
  currentTrack: LavalinkTrack | null;
  queue: LavalinkTrack[];
  isPlaying: boolean;
  volume: number;
  history: Record<string, any>;
  chat: any[];
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

      play: (track) => set({ currentTrack: track, isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      resume: () => set({ isPlaying: true }),
      addToQueue: (track) => set((state) => ({ 
        queue: state.currentTrack ? [...state.queue, track] : state.queue,
        currentTrack: state.currentTrack ? state.currentTrack : track,
        isPlaying: true
      })),
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
    }),
    {
      name: 'yakisoba-player-storage',
      partialize: (state) => ({ 
        volume: state.volume, 
        activeUsername: state.activeUsername,
        playerMode: state.playerMode,
        uiMode: state.uiMode
      }),
    }
  )
);
