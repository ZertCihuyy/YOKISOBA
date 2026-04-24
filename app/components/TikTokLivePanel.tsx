'use client';

import { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { Volume2, VolumeX, Filter, RefreshCw } from 'lucide-react';

// Basic bad word filter
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
  
  const { addToQueue, addChat, setStatus, clearChat, status, chat, setActiveUsername, activeUsername } = usePlayerStore();

  // Restore input from store if exists
  useEffect(() => {
    if (activeUsername && !usernameInput) setUsernameInput(activeUsername);
  }, [activeUsername]);

  const speak = (text: string) => {
    if (!ttsEnabled) return;
    if (!window.speechSynthesis) return;
    
    // Don't speak commands or very long texts
    if (text.startsWith('!') || text.length > 100) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID'; // default indonesian
    window.speechSynthesis.speak(utterance);
  };

  const connect = (retryCount = 0) => {
    if (!usernameInput) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setActiveUsername(usernameInput);
    setStatus(retryCount > 0 ? 'Reconnecting...' : 'Connecting...');
    if (retryCount === 0) clearChat();

    const es = new EventSource(`/api/tiktok?username=${encodeURIComponent(usernameInput)}`);
    eventSourceRef.current = es;

    es.addEventListener('connected', (e) => {
      setStatus('Connected');
      setReconnectAttempts(0); // reset attempts on success
      addChat({ user: 'System', comment: retryCount > 0 ? `Reconnected to ${usernameInput}` : `Connected to ${usernameInput}`, isCommand: false });
    });

    es.addEventListener('chat', (e) => {
      const data = JSON.parse(e.data);
      
      // Bad Word Filter
      if (filterEnabled && containsBadWord(data.comment)) {
        data.comment = '*** (filtered) ***';
      }

      addChat(data);
      if (!data.isCommand && data.user !== 'System') {
        const textToSpeak = readUsername ? `${data.user} bilang ${data.comment}` : data.comment;
        speak(textToSpeak);
      }
    });

    es.addEventListener('track_found', (e) => {
      const data = JSON.parse(e.data);
      addToQueue(data.track);
      addChat({ user: 'System', comment: `🎵 Added ${data.track.info.title} (Requested by ${data.user})`, isCommand: true });
      const requestText = readUsername ? `Lagu ditambahkan oleh ${data.user}` : `Lagu ditambahkan ke antrean`;
      speak(requestText);
    });

    const handleDisconnect = (reason: string) => {
      setStatus('Disconnected');
      es.close();
      
      // Auto Reconnect Logic (max 5 times)
      if (reconnectAttempts < 5) {
        addChat({ user: 'System', comment: `${reason}. Auto reconnect in 5s... (${reconnectAttempts + 1}/5)`, isCommand: false });
        const nextAttempt = reconnectAttempts + 1;
        setReconnectAttempts(nextAttempt);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect(nextAttempt);
        }, 5000);
      } else {
        addChat({ user: 'System', comment: `${reason}. Max reconnect attempts reached. Please manually reconnect.`, isCommand: false });
      }
    };

    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse(e.data);
        console.error('TikTok Error:', data.message);
        
        // Don't auto-reconnect if the user is clearly not live or invalid username
        if (data.message.includes('not found') || data.message.includes('not currently live')) {
          setStatus('Disconnected');
          es.close();
          addChat({ user: 'System', comment: `Connection Failed: User might not be live.`, isCommand: false });
        } else {
          handleDisconnect(`Error: ${data.message}`);
        }
      } catch {
        console.error('Connection closed by server');
        handleDisconnect('Connection lost');
      }
    });

    es.addEventListener('ended', () => {
      handleDisconnect('Stream ended');
    });
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setStatus('Disconnected');
      setReconnectAttempts(0);
      addChat({ user: 'System', comment: `Disconnected manually.`, isCommand: false });
    }
  };

  const manualReconnect = () => {
    disconnect();
    setTimeout(() => connect(0), 500);
  };

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  return (
    <div className="flex flex-col h-full relative">
      <h2 className="text-2xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500 tracking-tighter flex-shrink-0">
        TikTok Live DJ
      </h2>
      
      <div className="flex flex-col space-y-2 mb-4 flex-shrink-0">
        <div className="flex space-x-2">
          <input 
            type="text" 
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="@username"
            className="bg-zinc-900/80 border border-zinc-700 text-white px-4 py-2 rounded-lg flex-1 outline-none focus:ring-2 focus:ring-pink-500 transition-all font-medium"
            disabled={status !== 'Disconnected' && status !== 'Reconnecting...'}
          />
          {status === 'Disconnected' ? (
            <button onClick={() => connect(0)} className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-5 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity shadow-lg shadow-pink-500/20">
              Connect
            </button>
          ) : (
            <button onClick={disconnect} className="bg-zinc-800 text-white border border-zinc-700 px-5 py-2 rounded-lg font-bold hover:bg-red-500/20 hover:border-red-500 hover:text-red-400 transition-colors">
              Stop
            </button>
          )}
        </div>
        
        {/* Settings Row */}
        <div className="flex flex-wrap gap-2 items-center bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 justify-center sm:justify-start">
          <button 
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${
              ttsEnabled ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>TTS (Suara)</span>
          </button>

          <button 
            onClick={() => setReadUsername(!readUsername)}
            className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${
              readUsername ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <span>Sebut Nama</span>
          </button>
          
          <button 
            onClick={() => setFilterEnabled(!filterEnabled)}
            className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${
              filterEnabled ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Filter size={14} />
            <span>Filter</span>
          </button>
        </div>
      </div>
      
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="text-sm font-medium text-zinc-400">
          Status: 
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
            status === 'Connected' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
            status === 'Connecting...' || status === 'Reconnecting...' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 
            'bg-zinc-800 text-zinc-500 border border-zinc-700'
          }`}>
            {status}
          </span>
        </div>
        {status === 'Connected' && (
          <div className="flex items-center space-x-1.5 bg-red-500/10 px-2 py-1 rounded-full border border-red-500/20">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Live Chat</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-950/50 rounded-xl p-4 border border-zinc-800/50 space-y-3 relative shadow-inner mb-3">
        {chat.map((msg, i) => (
          <div key={i} className={`text-sm rounded-lg p-2.5 transition-all ${
            msg.user === 'System' ? 'bg-blue-500/10 border border-blue-500/20 text-blue-200 text-xs italic' :
            msg.isCommand ? 'bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20' : 
            'hover:bg-white/5'
          }`}>
            {msg.user !== 'System' && (
              <span className="font-bold text-zinc-300 mr-2 drop-shadow-md">{msg.user}:</span>
            )}
            <span className={msg.isCommand ? 'text-pink-400 font-bold drop-shadow-md' : 'text-zinc-200 leading-relaxed'}>
              {msg.comment}
            </span>
          </div>
        ))}
        {chat.length === 0 && status !== 'Disconnected' && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 font-medium">
            Waiting for chat...
          </div>
        )}
      </div>
      
      {/* Manual Reconnect Button at the bottom */}
      <button 
        onClick={manualReconnect}
        disabled={!activeUsername}
        className="w-full flex items-center justify-center space-x-2 bg-zinc-900 border border-zinc-700 text-zinc-300 px-4 py-2.5 rounded-lg font-bold hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
      >
        <RefreshCw size={16} className={status === 'Reconnecting...' ? 'animate-spin text-pink-500' : ''} />
        <span>Force Reconnect</span>
      </button>
    </div>
  );
}
