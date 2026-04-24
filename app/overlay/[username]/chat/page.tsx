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

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [chat]);

  return (
    <div className="h-screen w-screen bg-transparent p-4 lg:p-10 overflow-hidden flex flex-col justify-end pointer-events-none">
      <div 
        ref={containerRef}
        className="w-full max-w-lg max-h-[98vh] overflow-y-hidden flex flex-col space-y-5 pb-12 scroll-smooth"
      >
        {chat.map((msg, i) => {
          const isSystem = msg.user === 'System';
          const isGift = msg.type === 'gift';
          const isJoin = msg.type === 'member';
          const isLike = msg.type === 'like';

          return (
            <div 
              key={i} 
              className={`animate-in slide-in-from-left-10 fade-in duration-700 rounded-[32px] p-5 shadow-2xl flex items-start space-x-5 backdrop-blur-3xl border-2 transition-all group ${
                isSystem ? 'bg-blue-600/50 border-blue-400/60 text-white' :
                isGift ? 'bg-gradient-to-br from-yellow-400/60 via-orange-500/70 to-red-600/80 border-yellow-300 scale-110 shadow-[0_0_40px_rgba(245,158,11,0.6)] animate-bounce mb-4' :
                msg.isCommand ? 'bg-gradient-to-r from-purple-700/60 to-pink-600/60 border-pink-400/60 text-white shadow-[0_0_30px_rgba(236,72,153,0.4)]' : 
                isLike ? 'bg-red-600/40 border-red-400/50' :
                isJoin ? 'bg-green-600/30 border-green-400/40 shadow-lg' :
                'bg-black/50 border-white/20 text-white'
              }`}
            >
              {!isSystem && msg.avatar && (
                <div className="relative flex-shrink-0">
                  <img src={msg.avatar} alt="" className="w-16 h-16 rounded-full border-4 border-white/30 shadow-2xl object-cover ring-4 ring-black/20" />
                  {isGift && <div className="absolute -top-2 -right-2 text-3xl animate-pulse">🎁</div>}
                  {isJoin && <div className="absolute -bottom-1 -right-1 text-xl">👋</div>}
                  {isLike && <div className="absolute -bottom-1 -right-1 text-xl">❤️</div>}
                </div>
              )}
              
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center space-x-3 mb-1.5">
                  <span className={`font-black text-lg lg:text-xl tracking-tighter drop-shadow-xl truncate ${
                    isGift ? 'text-white underline decoration-yellow-400' : 
                    msg.isCommand ? 'text-pink-100' : 
                    'text-yellow-400'
                  }`}>
                    @{msg.user}
                  </span>
                  {isGift && (
                    <span className="text-[12px] bg-white text-red-600 px-3 py-1 rounded-full font-black uppercase tracking-widest animate-pulse shadow-lg">
                      SULTAN
                    </span>
                  )}
                </div>
                
                <div className={`font-extrabold leading-tight drop-shadow-md break-words tracking-tight ${
                  isGift ? 'text-white text-2xl uppercase' : 
                  isJoin ? 'text-green-200 text-[16px]' :
                  isLike ? 'text-red-100 text-[16px]' :
                  'text-zinc-50 text-[18px]'
                }`}>
                  {msg.comment}
                </div>

                {isGift && msg.giftData && (
                  <div className="mt-4 flex items-center bg-white/10 backdrop-blur-md rounded-[24px] p-4 border border-white/30 shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]"></div>
                    <div className="bg-white p-2 rounded-2xl shadow-2xl transform rotate-3">
                      <img src={msg.giftData.image} alt="" className="w-20 h-24 object-contain drop-shadow-2xl" />
                    </div>
                    <div className="ml-6 relative z-10">
                      <div className="text-zinc-200 font-black text-sm uppercase tracking-widest leading-none mb-2 drop-shadow-md">Exclusive Gift</div>
                      <div className="text-white font-black text-4xl lg:text-5xl leading-none flex items-baseline drop-shadow-2xl">
                        {msg.giftData.name}
                        <span className="ml-3 text-yellow-300 text-6xl italic animate-[pulse_0.5s_infinite]">x{msg.giftData.count}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
