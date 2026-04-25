'use client';
import { useState } from 'react';

export default function MusicSearch() {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setTracks([]);
    try {
      const res = await fetch(`/api/lavalink?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (res.ok && Array.isArray(data)) {
        setTracks(data);
      } else if (data.message) {
        setError(data.message);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 lg:p-10 bg-[#0d1117] text-[#c9d1d9] min-h-screen">
      <h2 className="text-2xl font-bold mb-5 flex items-center">
        <span className="mr-3">🎵</span> Music Summoner
      </h2>
      <div className="flex mb-6">
        <input 
          type="text" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari lagu anime..."
          className="p-3 w-[300px] rounded-lg border-none bg-[#161b22] text-[#c9d1d9] focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button 
          onClick={handleSearch} 
          disabled={loading}
          className="ml-3 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Summoning...' : 'Summon!'}
        </button>
      </div>

      {error && (
        <div className="text-red-400 mb-4 bg-red-900/20 p-3 rounded border border-red-900/50">
          {error}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {tracks.map((track, i) => (
          <div key={i} className="border-b border-[#30363d] p-3 hover:bg-[#161b22] rounded transition-colors">
            <p className="mb-1 text-white">
              <strong>{track.info.title}</strong> - <span className="text-[#8b949e]">{track.info.author}</span>
            </p>
            <code className="text-[10px] text-[#8b949e] bg-[#010409] p-1 rounded break-all block">
              Track ID: {track.encoded.substring(0, 40)}...
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}
