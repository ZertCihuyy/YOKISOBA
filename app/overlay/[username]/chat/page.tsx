'use client';

import { useReceiveState } from '../../../../lib/sync';
import { usePlayerStore } from '../../../../store/playerStore';
import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

export default function ChatOverlay() {
  const params = useParams();
  const username = params.username as string;
  
  useReceiveState(username);
  const { chat } = usePlayerStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [chat]);

  return (
    <div className="h-screen w-screen bg-transparent p-4 overflow-hidden flex flex-col justify-end pointer-events-none">
      <div 
        ref={containerRef}
        className="w-full max-w-sm max-h-[80vh] overflow-y-hidden flex flex-col space-y-3 pb-4 scroll-smooth"
      >
        {chat.map((msg, i) => (
          <div 
            key={i} 
            className={`animate-in slide-in-from-left-4 fade-in duration-300 rounded-xl p-3 shadow-lg ${
              msg.user === 'System' ? 'bg-blue-500/80 backdrop-blur-md border border-blue-400 text-white shadow-blue-500/20' :
              msg.isCommand ? 'bg-gradient-to-r from-pink-500/90 to-purple-500/90 backdrop-blur-md border border-pink-400 text-white shadow-pink-500/30' : 
              'bg-black/70 backdrop-blur-md border border-zinc-700 text-white shadow-black/50'
            }`}
          >
            {msg.user !== 'System' && (
              <span className={`font-black mr-2 drop-shadow-md ${msg.isCommand ? 'text-pink-200' : 'text-zinc-400'}`}>
                {msg.user}
              </span>
            )}
            <span className={`font-bold drop-shadow-md ${msg.isCommand ? 'text-white' : 'text-zinc-100'}`}>
              {msg.comment}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
