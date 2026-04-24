'use client';

import { useReceiveState } from '../../../../lib/sync';
import { usePlayerStore } from '../../../../store/playerStore';
import { Disc3 } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function QueueOverlay() {
  const params = useParams();
  const username = params.username as string;
  
  useReceiveState(username);
  const { currentTrack, queue } = usePlayerStore();

  if (!currentTrack && queue.length === 0) {
    return <div className="h-screen w-screen bg-transparent pointer-events-none"></div>;
  }

  return (
    <div className="h-screen w-screen bg-transparent p-6 flex flex-col justify-start items-end pointer-events-none">
      <div className="w-[350px] space-y-4">
        
        {/* Now Playing Panel */}
        {currentTrack && (
          <div className="bg-black/80 backdrop-blur-xl border-2 border-green-500/50 rounded-2xl p-4 shadow-2xl shadow-green-500/20 transform transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-black text-green-400 tracking-widest uppercase flex items-center bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/30">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping mr-2"></div>
                Now Playing
              </div>
              <Disc3 size={20} className="text-green-500 animate-[spin_3s_linear_infinite]" />
            </div>
            
            <div className="flex items-center space-x-4">
              {currentTrack.info.artworkUrl ? (
                <img src={currentTrack.info.artworkUrl} alt="" className="w-16 h-16 rounded-xl object-cover shadow-md border border-zinc-700/50" />
              ) : (
                <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700/50">
                  <Disc3 className="text-zinc-500" />
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <div className="text-white font-bold text-lg leading-tight truncate drop-shadow-md">
                  {currentTrack.info.title}
                </div>
                <div className="text-zinc-300 font-medium text-sm truncate mt-1">
                  {currentTrack.info.author}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Up Next Queue */}
        {queue.length > 0 && (
          <div className="bg-black/60 backdrop-blur-md border border-zinc-700/50 rounded-2xl p-4 shadow-xl">
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-3 px-1">
              Up Next
            </h3>
            <div className="space-y-2">
              {queue.slice(0, 4).map((track, idx) => (
                <div key={idx} className="flex items-center bg-zinc-900/60 rounded-xl p-2.5 border border-zinc-800/50">
                  <div className="text-zinc-500 font-black text-xs w-6 flex-shrink-0">{idx + 1}</div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-white text-sm font-bold truncate">{track.info.title}</div>
                    <div className="text-zinc-400 text-xs font-medium truncate">{track.info.author}</div>
                  </div>
                </div>
              ))}
              {queue.length > 4 && (
                <div className="text-center text-xs font-bold text-zinc-500 pt-1">
                  + {queue.length - 4} more in queue
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
