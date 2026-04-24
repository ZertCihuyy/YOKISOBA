'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { Volume2, VolumeX, Filter, RefreshCw, Users, WifiOff } from 'lucide-react';

const BAD_WORDS = ['badword1', 'badword2', 'anjing', 'babi', 'bangsat', 'kontol', 'ngentot', 'memek', 'goblok', 'tolol'];
const containsBadWord = (text: string) => {
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => lowerText.includes(word));
};

export default function TikTokLivePanel() {
  const [usernameInput, setUsernameInput] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState(true);
  const [readUsername, setReadUsername] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStartTimeRef = useRef(Date.now());

  const { 
    addToQueue, addChat, setStatus, clearChat, 
    status, chat, setActiveUsername, activeUsername, 
    viewerCount, setViewerCount 
  } = usePlayerStore();

  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    if (text.startsWith('!') || text.length > 150) return;

    // Batalkan bicara sebelumnya agar tidak menumpuk terlalu lama
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = 1.1; // Sedikit lebih cepat agar tidak ketinggalan chat
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled]);

  const connect = useCallback((retryCount = 0) => {
    if (!usernameInput) return;
    
    // Cleanup
    if (eventSourceRef.current) eventSourceRef.current.close();
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    const targetUser = usernameInput.replace('@', '');
    setActiveUsername(targetUser);
    setStatus(retryCount > 0 ? 'Reconnecting...' : 'Connecting...');
    
    const es = new EventSource(`/api/tiktok?username=${encodeURIComponent(targetUser)}`);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setStatus('Connected');
      setReconnectAttempts(0);
      connectionStartTimeRef.current = Date.now();
      addChat({ 
        user: 'System', nickname: 'System', avatar: '', 
        comment: `Berhasil tersambung ke @${targetUser}`, 
        isCommand: false, type: 'chat' 
      });
    });

    es.addEventListener('chat', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      if (filterEnabled && containsBadWord(data.comment)) {
        data.comment = '***';
      }

      addChat(data);
      
      const isNewMessage = Date.now() - connectionStartTimeRef.current > 5000;
      if (data.type === 'chat' && !data.isCommand && isNewMessage) {
        const textToSpeak = readUsername ? `${data.nickname || data.user} bilang: ${data.comment}` : data.comment;
        speak(textToSpeak);
      }
    });

    es.addEventListener('track_found', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      addToQueue(data.track);
      addChat({ 
        user: 'System', nickname: 'System', avatar: '', 
        comment: `🎵 Lagu ditambahkan: ${data.track.info.title}`, 
        isCommand: true, type: 'chat' 
      });
      speak(`Lagu dari ${data.user} telah ditambahkan.`);
    });

    es.addEventListener('room_update', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setViewerCount(data.viewerCount);
    });

    const handleRetry = () => {
      if (retryCount < 10) { // Maksimal 10 kali coba
        const nextRetryIn = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff max 30s
        setStatus('Disconnected');
        console.log(`Retrying in ${nextRetryIn}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => connect(retryCount + 1), nextRetryIn);
        setReconnectAttempts(retryCount + 1);
      } else {
        setStatus('Disconnected');
        addChat({ user: 'System', nickname: 'System', avatar: '', comment: `Gagal menyambung kembali setelah beberapa kali percobaan.`, isCommand: false, type: 'chat' });
      }
    };

    es.onerror = () => {
      es.close();
      handleRetry();
    };

    es.addEventListener('tiktok_error', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      if (data.message.includes('not currently live')) {
        setStatus('Disconnected');
        es.close();
        addChat({ user: 'System', nickname: 'System', avatar: '', comment: `User tidak sedang Live.`, isCommand: false, type: 'chat' });
      } else {
        es.close();
        handleRetry();
      }
    });
  }, [usernameInput, filterEnabled, readUsername, speak, addChat, addToQueue, setActiveUsername, setStatus, setViewerCount]);

  const disconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setStatus('Disconnected');
      setReconnectAttempts(0);
      addChat({ user: 'System', nickname: 'System', avatar: '', comment: `Koneksi diputus manual.`, isCommand: false, type: 'chat' });
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  useEffect(() => {
    if (activeUsername && !usernameInput) setUsernameInput(activeUsername);
  }, [activeUsername]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500 tracking-tighter">
          TikTok DJ
        </h2>
        {status === 'Connected' ? (
          <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
            <Users size={14} className="text-pink-500" />
            <span className="text-xs font-black text-white">{viewerCount}</span>
          </div>
        ) : status === 'Reconnecting...' ? (
          <div className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full animate-pulse font-bold">
            Reconnect #{reconnectAttempts}
          </div>
        ) : null}
      </div>
      
      <div className="flex flex-col space-y-2 mb-4 flex-shrink-0">
        <div className="flex space-x-2">
          <input 
            type="text" 
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && connect(0)}
            placeholder="@username live"
            className="bg-zinc-900/80 border border-zinc-700 text-white px-4 py-2 rounded-lg flex-1 outline-none focus:ring-2 focus:ring-pink-500 transition-all font-medium"
          />
          {status === 'Disconnected' ? (
            <button onClick={() => connect(0)} className="bg-pink-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-pink-500 transition-colors">
              Mulai
            </button>
          ) : (
            <button onClick={disconnect} className="bg-zinc-800 text-red-400 border border-zinc-700 px-5 py-2 rounded-lg font-bold">
              Stop
            </button>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
          <button 
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`flex items-center space-x-1.5 text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors ${
              ttsEnabled ? 'bg-pink-500 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {ttsEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            <span>TTS {ttsEnabled ? 'ON' : 'OFF'}</span>
          </button>
          <button 
            onClick={() => setReadUsername(!readUsername)}
            className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors ${
              readUsername ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            Sebut Nama: {readUsername ? 'YA' : 'TIDAK'}
          </button>
          <button 
            onClick={() => setFilterEnabled(!filterEnabled)}
            className={`flex items-center space-x-1.5 text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors ${
              filterEnabled ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            <Filter size={12} />
            <span>Filter</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-black/40 rounded-xl p-3 border border-zinc-800/50 space-y-2 mb-3 shadow-inner scrollbar-hide">
        {chat.length === 0 && (status === 'Disconnected') && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 italic text-xs">
            <WifiOff size={24} className="mb-2 opacity-20" />
            Belum ada koneksi
          </div>
        )}
        {chat.map((msg, i) => (
          <div key={i} className={`text-xs p-2 rounded-lg ${
            msg.user === 'System' ? 'bg-zinc-800/50 text-zinc-400 italic' : 
            msg.isCommand ? 'bg-pink-500/10 border border-pink-500/20 text-pink-200' : 
            'bg-white/5 text-zinc-200'
          }`}>
            <span className="font-black text-zinc-400 mr-1">{msg.nickname || msg.user}:</span>
            {msg.comment}
          </div>
        ))}
      </div>
      
      <button 
        onClick={() => connect(0)}
        disabled={!activeUsername || status === 'Connected'}
        className="w-full flex items-center justify-center space-x-2 bg-zinc-900 border border-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors disabled:opacity-30"
      >
        <RefreshCw size={14} className={status === 'Reconnecting...' ? 'animate-spin text-pink-500' : ''} />
        <span>Paksa Sambung Ulang</span>
      </button>
    </div>
  );
}
