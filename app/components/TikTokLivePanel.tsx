'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { Volume2, VolumeX, Filter, RefreshCw, Users, WifiOff, Settings, List, PlaySquare, MessageSquare, Trash2 } from 'lucide-react';

const BAD_WORDS = ['badword1', 'badword2', 'anjing', 'babi', 'bangsat', 'kontol', 'ngentot', 'memek', 'goblok', 'tolol'];
const containsBadWord = (text: string) => {
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => lowerText.includes(word));
};

export default function TikTokLivePanel() {
  const [usernameInput, setUsernameInput] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [filterEnabled, setFilterEnabled] = useState(true);
  const [readUsername, setReadUsername] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [activeTab, setActiveTab] = useState<'chat' | 'settings' | 'review' | 'fallback'>('chat');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStartTimeRef = useRef(Date.now());
  const skipInitialMessagesRef = useRef(true);
  const ttsAudioRefs = useRef<HTMLAudioElement[]>([]);
  const ttsEnabledRef = useRef(ttsEnabled);

  const { 
    addToQueue, removeFromQueue, addChat, setStatus, clearChat, 
    status, chat, setActiveUsername, activeUsername, 
    viewerCount, setViewerCount,
    permissions, setPermissions,
    reviewQueue, addReview, clearReviews,
    fallbackPlaylist, setFallbackPlaylist, isFallbackEnabled, toggleFallback,
    next
  } = usePlayerStore();

  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  const speak = useCallback(async (text: string) => {
    if (!ttsEnabledRef.current) {
      console.log('TTS disabled, skipping:', text);
      return;
    }
    const trimmedText = text.trim();
    if (!trimmedText || trimmedText.startsWith('!') || trimmedText.length > 200) {
      console.log('TTS skipped (invalid text):', trimmedText);
      return;
    }

    console.log('TTS speaking:', trimmedText);

    try {
      const response = await fetch(`/api/tts?text=${encodeURIComponent(trimmedText)}`);
      if (!response.ok) {
        console.error('TTS API failed:', response.status);
        throw new Error('TTS API fetch failed');
      }

      const audioBlob = await response.blob();
      console.log('TTS blob received, size:', audioBlob.size);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';

      ttsAudioRefs.current.push(audio);
      audio.onended = () => {
        console.log('TTS audio ended');
        URL.revokeObjectURL(audioUrl);
        ttsAudioRefs.current = ttsAudioRefs.current.filter((item) => item !== audio);
      };

      audio.onerror = (e) => {
        console.error('Audio play error:', e);
        URL.revokeObjectURL(audioUrl);
        ttsAudioRefs.current = ttsAudioRefs.current.filter((item) => item !== audio);
      };

      const playPromise = audio.play();
      console.log('TTS audio play initiated');
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('TTS audio started playing');
        }).catch((error) => {
          console.error('Audio play blocked:', error);
        });
      }
    } catch (error) {
      console.error('TTS failed:', error);

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          console.log('Using speechSynthesis fallback');
          const utterance = new SpeechSynthesisUtterance(trimmedText);
          utterance.lang = 'id-ID';
          utterance.rate = 1.05;
          utterance.onerror = (event) => console.error('SpeechSynthesis error:', event);
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        } catch (fallbackError) {
          console.error('SpeechSynthesis fallback failed:', fallbackError);
        }
      }
    }
  }, []);

  const connect = useCallback((retryCount = 0) => {
    if (!usernameInput) return;
    
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
      skipInitialMessagesRef.current = true;
      setTimeout(() => {
        skipInitialMessagesRef.current = false;
      }, 2000);
      addChat({ 
        user: 'System', nickname: 'System', avatar: '', 
        comment: `Berhasil tersambung ke @${targetUser}`, 
        isCommand: false, type: 'chat' 
      });
    });

    es.addEventListener('chat', async (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      if (filterEnabled && containsBadWord(data.comment)) {
        data.comment = '***';
      }

      addChat(data);
      
      const isNewMessage = !skipInitialMessagesRef.current;
      
      if (data.isCommand && isNewMessage) {
        const comment = data.comment.toLowerCase();
        const isFollower = data.isFollower;
        const currentPerms = usePlayerStore.getState().permissions;

        const canPlay = currentPerms.play === 'all' || isFollower;
        const canSkip = currentPerms.skip === 'all' || isFollower;
        const canRp = currentPerms.rp === 'all' || isFollower;

        if (comment.startsWith('!play ')) {
          if (!canPlay) {
            addChat({ user: 'System', nickname: 'System', avatar: '', comment: `⚠️ @${data.user}, hanya follower yang bisa request lagu.`, isCommand: true, type: 'chat' });
            return;
          }
          const query = data.comment.substring(6).trim();
          addChat({ user: 'System', nickname: 'System', avatar: '', comment: `🔍 Mencari lagu: ${query}...`, isCommand: true, type: 'chat' });
          try {
            const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
            const searchData = await res.json();
            if (searchData.loadType === 'search' || searchData.loadType === 'track') {
              const track = searchData.data[0];
              if (track) {
                  track.userData = { requester: data.user, nickname: data.nickname };
                  usePlayerStore.getState().addToQueue(track);
                  addChat({ user: 'System', nickname: 'System', avatar: '', comment: `🎵 Lagu ditambahkan: ${track.info.title} oleh @${data.user}`, isCommand: true, type: 'chat' });
                  speak(`Lagu dari ${data.nickname || data.user} telah ditambahkan.`);
              }
            } else {
                addChat({ user: 'System', nickname: 'System', avatar: '', comment: `❌ Lagu tidak ditemukan: ${query}`, isCommand: true, type: 'chat' });
            }
          } catch(err) {
             addChat({ user: 'System', nickname: 'System', avatar: '', comment: `❌ Error mencari lagu.`, isCommand: true, type: 'chat' });
          }
        } else if (comment.startsWith('!skip')) {
          if (!canSkip) {
            addChat({ user: 'System', nickname: 'System', avatar: '', comment: `⚠️ @${data.user}, kamu tidak ada akses !skip.`, isCommand: true, type: 'chat' });
            return;
          }
          usePlayerStore.getState().next();
          addChat({ user: 'System', nickname: 'System', avatar: '', comment: `⏭️ Lagu diskip oleh @${data.user}`, isCommand: true, type: 'chat' });
        } else if (comment.startsWith('!revoke')) {
          usePlayerStore.getState().removeFromQueue(data.user);
          addChat({ user: 'System', nickname: 'System', avatar: '', comment: `🗑️ Antrean dihapus untuk @${data.user}`, isCommand: true, type: 'chat' });
        } else if (comment.startsWith('!rp ')) {
          if (!canRp) {
            addChat({ user: 'System', nickname: 'System', avatar: '', comment: `⚠️ @${data.user}, hanya follower yang bisa request review.`, isCommand: true, type: 'chat' });
            return;
          }
          const query = data.comment.substring(4).trim();
          usePlayerStore.getState().addReview({ user: data.user, nickname: data.nickname || data.user, content: query });
          addChat({ user: 'System', nickname: 'System', avatar: '', comment: `📝 Request Review masuk: ${query}`, isCommand: true, type: 'chat' });
        }
      }

      if (data.type === 'chat' && !data.isCommand && isNewMessage) {
        const textToSpeak = readUsername ? `${data.nickname || data.user} bilang: ${data.comment}` : data.comment;
        console.log('New chat message, calling TTS:', textToSpeak);
        speak(textToSpeak);
      }
    });

    es.addEventListener('room_update', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setViewerCount(data.viewerCount);
    });

    const handleRetry = () => {
      if (retryCount < 10) {
        const nextRetryIn = Math.min(1000 * Math.pow(2, retryCount), 30000);
        setStatus('Disconnected');
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
  }, [usernameInput, filterEnabled, readUsername, speak, setActiveUsername, setStatus, setViewerCount, addChat]);

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

  const hydratedActiveUsername = hasMounted ? activeUsername : '';
  const hydratedStatus = hasMounted ? status : 'Disconnected';
  const reconnectDisabled = hasMounted && (!activeUsername || status === 'Connected');

  useEffect(() => {
    if (activeUsername && !usernameInput) setUsernameInput(activeUsername);
  }, [activeUsername]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
      ttsAudioRefs.current.forEach((audio) => {
        audio.pause();
        if (audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
      });
      ttsAudioRefs.current = [];
    };
  }, []);

  const fetchFallbackPlaylist = async () => {
    if (!fallbackUrl) return;
    setLoadingFallback(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(fallbackUrl)}`);
      const searchData = await res.json();
      if (searchData.loadType === 'playlist') {
         setFallbackPlaylist(searchData.data);
         addChat({ user: 'System', nickname: 'System', avatar: '', comment: `Berhasil memuat ${searchData.data.length} lagu fallback.`, isCommand: false, type: 'chat' });
      } else {
         alert('Gagal memuat playlist. Pastikan URL Valid!');
      }
    } catch(e) {
      alert('Error fetching playlist');
    } finally {
      setLoadingFallback(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500 tracking-tighter">
          TikTok DJ
        </h2>
        {hydratedStatus === 'Connected' ? (
          <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
            <Users size={14} className="text-pink-500" />
            <span className="text-xs font-black text-white">{viewerCount}</span>
          </div>
        ) : hydratedStatus === 'Reconnecting...' ? (
          <div className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full animate-pulse font-bold">
            Reconnect #{reconnectAttempts}
          </div>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-3 bg-zinc-900/50 p-1 rounded-lg flex-shrink-0">
        <button onClick={() => setActiveTab('chat')} className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center space-x-1 ${activeTab === 'chat' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}>
          <MessageSquare size={12} /> <span>Chat</span>
        </button>
        <button onClick={() => setActiveTab('review')} className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center space-x-1 ${activeTab === 'review' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}>
          <List size={12} /> <span>!rp</span>
          {reviewQueue.length > 0 && <span className="ml-1 bg-red-500 text-white px-1.5 rounded-full text-[9px]">{reviewQueue.length}</span>}
        </button>
        <button onClick={() => setActiveTab('fallback')} className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center space-x-1 ${activeTab === 'fallback' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}>
          <PlaySquare size={12} /> <span>Fallback</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center space-x-1 ${activeTab === 'settings' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}>
          <Settings size={12} /> <span>Perms</span>
        </button>
      </div>
      
      {activeTab === 'chat' && (
        <>
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
              {hydratedStatus === 'Disconnected' ? (
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
            {chat.length === 0 && (hydratedStatus === 'Disconnected') && (
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
            disabled={reconnectDisabled}
            className="w-full flex items-center justify-center space-x-2 bg-zinc-900 border border-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors disabled:opacity-30"
          >
            <RefreshCw size={14} className={hydratedStatus === 'Reconnecting...' ? 'animate-spin text-pink-500' : ''} />
            <span>Paksa Sambung Ulang</span>
          </button>
        </>
      )}

      {activeTab === 'review' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-black/40 rounded-xl border border-zinc-800/50">
          <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
            <h3 className="text-sm font-bold text-white">Review Queue (!rp)</h3>
            <button onClick={clearReviews} className="text-xs flex items-center space-x-1 text-red-400 hover:text-red-300 bg-red-900/20 px-2 py-1 rounded">
              <Trash2 size={12} /> <span>Clear All</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {reviewQueue.length === 0 ? (
              <div className="text-zinc-600 text-xs text-center mt-10">Antrean review kosong</div>
            ) : (
              reviewQueue.map(item => (
                <div key={item.id} className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700/50">
                  <div className="text-[10px] text-zinc-400 mb-1 font-bold">@{item.user}</div>
                  <div className="text-sm text-white break-all">{item.content}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'fallback' && (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
            <h3 className="text-sm font-bold text-white mb-2">Fallback Playlist</h3>
            <p className="text-xs text-zinc-400 mb-4">Lagu akan diputar otomatis dari playlist ini jika tidak ada yang request (!play).</p>
            
            <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-lg mb-4">
              <span className="text-xs font-bold text-white">Enable Fallback Mode</span>
              <button 
                onClick={toggleFallback}
                className={`w-10 h-5 rounded-full relative transition-colors ${isFallbackEnabled ? 'bg-green-500' : 'bg-zinc-600'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${isFallbackEnabled ? 'left-6' : 'left-1'}`}></div>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400">Load YT/Spotify Playlist URL</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={fallbackUrl}
                  onChange={(e) => setFallbackUrl(e.target.value)}
                  placeholder="https://youtube.com/playlist..."
                  className="flex-1 bg-black/50 border border-zinc-700 text-white px-3 py-2 text-xs rounded outline-none focus:border-pink-500"
                />
                <button 
                  onClick={fetchFallbackPlaylist}
                  disabled={loadingFallback || !fallbackUrl}
                  className="bg-pink-600 text-white px-3 py-2 rounded text-xs font-bold disabled:opacity-50"
                >
                  {loadingFallback ? 'Loading...' : 'Load'}
                </button>
              </div>
              <div className="text-[10px] text-zinc-500 mt-2">
                Currently Loaded: <span className="font-bold text-pink-400">{fallbackPlaylist.length} tracks</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
            <h3 className="text-sm font-bold text-white mb-4">Command Permissions</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <div className="text-xs font-bold text-zinc-300">!play (Request Lagu)</div>
                <select 
                  value={permissions.play}
                  onChange={(e) => setPermissions({ play: e.target.value as any })}
                  className="bg-black border border-zinc-700 text-white text-xs px-2 py-1 rounded outline-none"
                >
                  <option value="all">Semua Orang</option>
                  <option value="followers">Hanya Followers</option>
                </select>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <div className="text-xs font-bold text-zinc-300">!skip (Skip Lagu)</div>
                <select 
                  value={permissions.skip}
                  onChange={(e) => setPermissions({ skip: e.target.value as any })}
                  className="bg-black border border-zinc-700 text-white text-xs px-2 py-1 rounded outline-none"
                >
                  <option value="all">Semua Orang</option>
                  <option value="followers">Hanya Followers</option>
                  <option value="admin">Hanya DJ (Panel)</option>
                </select>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-xs font-bold text-zinc-300">!rp (Review Request)</div>
                <select 
                  value={permissions.rp}
                  onChange={(e) => setPermissions({ rp: e.target.value as any })}
                  className="bg-black border border-zinc-700 text-white text-xs px-2 py-1 rounded outline-none"
                >
                  <option value="all">Semua Orang</option>
                  <option value="followers">Hanya Followers</option>
                </select>
              </div>
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 italic p-2 bg-zinc-900/30 rounded border border-zinc-800/50">
            Note: !revoke selalu terbuka untuk user yang ingin membatalkan lagunya sendiri. Info Follower didapat jika data dari TikTok tersedia.
          </div>
        </div>
      )}
    </div>
  );
}
