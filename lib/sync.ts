import { useEffect } from 'react';
import { usePlayerStore } from '../store/playerStore';

// For the main dashboard to broadcast state to the API
export function useBroadcastState(username: string) {
  useEffect(() => {
    if (!username) return;

    let timeoutId: NodeJS.Timeout;
    
    // Throttle the sync to prevent spamming the API
    const syncState = () => {
      const state = usePlayerStore.getState();
      fetch(`/api/state/${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTrack: state.currentTrack,
          queue: state.queue,
          chat: state.chat,
          status: state.status,
        }),
      }).catch(e => console.error('Failed to sync state:', e));
    };

    const unsubscribe = usePlayerStore.subscribe(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(syncState, 500); // 500ms debounce
    });

    // Initial sync
    syncState();

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [username]);
}

// For the overlays to receive state from the API by polling
export function useReceiveState(username: string) {
  useEffect(() => {
    if (!username) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/state/${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          // Only update if state has meaningfully changed to avoid re-renders
          // Zustand shallow comparison is fine, but we'll just set state
          // and let React handle the diffing of components.
          usePlayerStore.setState(data);
        }
      } catch (e) {
        console.error('Failed to poll state:', e);
      }
    }, 1000); // Poll every 1 second

    return () => clearInterval(interval);
  }, [username]);
}
