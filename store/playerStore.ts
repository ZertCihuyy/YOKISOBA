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
  isFollower?: boolean;
  giftData?: {
    name: string;
    count: number;
    image: string;
  };
}

export interface ReviewRequest {
  id: string;
  user: string;
  nickname: string;
  content: string;
  timestamp: number;
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
  playerMode: 'normal' | 'embed' | 'lavalink';
  uiMode: 'compact' | 'standard' | 'theater';
  
  // NEW FEATURES
  permissions: {
    play: 'all' | 'followers';
    skip: 'all' | 'followers' | 'admin';
    rp: 'all' | 'followers';
  };
  reviewQueue: ReviewRequest[];
  fallbackPlaylist: LavalinkTrack[];
  isFallbackEnabled: boolean;
  
  play: (track: LavalinkTrack) => void;
  pause: () => void;
  resume: () => void;
  addToQueue: (track: LavalinkTrack) => void;
  removeFromQueue: (user: string) => void;
  next: () => void;
  setVolume: (volume: number) => void;
  setStatus: (status: string) => void;
  setActiveUsername: (username: string) => void;
  setViewerCount: (count: number) => void;
  setPlayerMode: (mode: 'normal' | 'embed' | 'lavalink') => void;
  setUiMode: (mode: 'compact' | 'standard' | 'theater') => void;
  addChat: (msg: ChatMessage) => void;
  clearChat: () => void;
  getTopPlayed: () => LavalinkTrack[];
  
  // NEW ACTIONS
  setPermissions: (perms: Partial<PlayerState['permissions']>) => void;
  addReview: (req: Omit<ReviewRequest, 'id' | 'timestamp'>) => void;
  clearReviews: () => void;
  setFallbackPlaylist: (tracks: LavalinkTrack[]) => void;
  toggleFallback: () => void;
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
      
      permissions: {
        play: 'all',
        skip: 'followers',
        rp: 'all'
      },
      reviewQueue: [],
      fallbackPlaylist: [],
      isFallbackEnabled: false,

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

      removeFromQueue: (user) => set((state) => {
        // Remove the first track requested by this user (or all?)
        // Let's remove all tracks requested by this user in the queue
        const newQueue = state.queue.filter(t => t.userData?.requester !== user);
        return { queue: newQueue };
      }),

      next: () => set((state) => {
        if (state.queue.length > 0) {
          const [nextTrack, ...rest] = state.queue;
          return { currentTrack: nextTrack, queue: rest, isPlaying: true };
        } else if (state.isFallbackEnabled && state.fallbackPlaylist.length > 0) {
          // Play random or next from fallback playlist
          // Simple logic: pick random from fallback
          const randomIndex = Math.floor(Math.random() * state.fallbackPlaylist.length);
          const nextFallback = state.fallbackPlaylist[randomIndex];
          return { currentTrack: nextFallback, queue: [], isPlaying: true };
        } else {
          return { currentTrack: null, isPlaying: false };
        }
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
        const history = get().history || {};
        const tracks = Object.values(history)
          .sort((a: any, b: any) => (b.playCount || 0) - (a.playCount || 0))
          .slice(0, 10)
          .map((h: any) => h.track)
          .filter(t => t !== undefined);
        return tracks;
      },

      setPermissions: (perms) => set((state) => ({
        permissions: { ...state.permissions, ...perms }
      })),

      addReview: (req) => set((state) => ({
        reviewQueue: [...state.reviewQueue, { ...req, id: Math.random().toString(36).substr(2, 9), timestamp: Date.now() }]
      })),

      clearReviews: () => set({ reviewQueue: [] }),

      setFallbackPlaylist: (tracks) => set({ fallbackPlaylist: tracks }),

      toggleFallback: () => set((state) => ({ isFallbackEnabled: !state.isFallbackEnabled })),
    }),
    {
      name: 'yakisoba-player-storage',
      partialize: (state) => ({ 
        volume: state.volume, 
        activeUsername: state.activeUsername,
        playerMode: state.playerMode,
        uiMode: state.uiMode,
        history: state.history,
        permissions: state.permissions,
        reviewQueue: state.reviewQueue,
        fallbackPlaylist: state.fallbackPlaylist,
        isFallbackEnabled: state.isFallbackEnabled
      }),
    }
  )
);
