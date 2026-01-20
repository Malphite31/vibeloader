import React, { useState } from 'react';
import { Download, Youtube, Loader2, Play, AlertCircle, RefreshCw, Volume2, VolumeX, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// YOUR PROXMOX YT-DLP API URL - Change this after deploying
const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [qualities, setQualities] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [error, setError] = useState('');
  const [apiUrl, setApiUrl] = useState(API_URL);
  const [showSettings, setShowSettings] = useState(!API_URL);

  // Extract video ID from YouTube URL
  const extractVideoId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get quality badge
  const getQualityBadge = (resolution) => {
    if (resolution >= 2160) return { label: '4K', color: 'bg-purple-600' };
    if (resolution >= 1440) return { label: '2K', color: 'bg-blue-600' };
    if (resolution >= 1080) return { label: 'FHD', color: 'bg-green-600' };
    if (resolution >= 720) return { label: 'HD', color: 'bg-yellow-600' };
    return { label: 'SD', color: 'bg-zinc-600' };
  };

  const handleFetch = async (e) => {
    e.preventDefault();
    if (!url) return;
    
    if (!apiUrl) {
      setShowSettings(true);
      setError('Please set your yt-dlp API URL first');
      return;
    }
    
    setLoading(true);
    setError('');
    setVideoInfo(null);
    setQualities([]);
    setSelectedQuality(null);

    const videoId = extractVideoId(url);
    
    if (!videoId) {
      setError('Please enter a valid YouTube URL');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/info?v=${videoId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to fetch video info');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch video info');
      }

      setVideoInfo({
        id: videoId,
        title: data.title,
        author: data.author,
        thumbnail: data.thumbnail,
        duration: data.duration,
        views: data.views
      });

      // Sort formats by resolution
      const sortedFormats = (data.formats || [])
        .filter(f => f.resolution > 0)
        .sort((a, b) => b.resolution - a.resolution);

      setQualities(sortedFormats);
      if (sortedFormats.length > 0) {
        setSelectedQuality(sortedFormats[0]);
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not fetch video info. Check your API connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!selectedQuality) return;
    
    // Use direct URL if available
    if (selectedQuality.url) {
      window.open(selectedQuality.url, '_blank');
      return;
    }
    
    // Otherwise use the stream endpoint
    const streamUrl = `${apiUrl}/api/stream/${videoInfo.id}?q=${selectedQuality.resolution}`;
    window.open(streamUrl, '_blank');
  };

  const saveApiUrl = () => {
    localStorage.setItem('ytdlp_api_url', apiUrl);
    setShowSettings(false);
  };

  // Load saved API URL
  React.useEffect(() => {
    const saved = localStorage.getItem('ytdlp_api_url');
    if (saved) {
      setApiUrl(saved);
      setShowSettings(false);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-24">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <div className="flex justify-center mb-4">
          <div className="bg-red-600 p-3 rounded-2xl shadow-lg shadow-red-600/20">
            <Youtube size={48} className="text-white" />
          </div>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
          Vibe<span className="text-red-500">Loader</span>
        </h1>
        <p className="text-zinc-400 text-lg">Self-hosted YouTube downloader. No ads. No limits.</p>
        
        {/* Settings button */}
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="mt-4 text-zinc-500 hover:text-white transition-colors flex items-center gap-2 mx-auto"
        >
          <Settings size={16} />
          {apiUrl ? 'Change API' : 'Set API URL'}
        </button>
      </motion.div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="font-bold mb-4">yt-dlp API Settings</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="http://your-proxmox-ip:8000"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-red-500"
                />
                <button
                  onClick={saveApiUrl}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Deploy the yt-dlp-api on your Proxmox server and enter the URL here
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* URL Input */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-zinc-900/50 border border-zinc-800 p-2 rounded-2xl backdrop-blur-xl shadow-2xl mb-8"
      >
        <form onSubmit={handleFetch} className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            placeholder="Paste YouTube link here..."
            className="flex-1 bg-transparent px-6 py-4 outline-none text-lg text-zinc-100 placeholder:text-zinc-600"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button 
            type="submit"
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 text-white px-8 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Fetching...
              </>
            ) : (
              'Fetch'
            )}
          </button>
        </form>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 text-center mb-6"
          >
            <div className="flex items-center gap-2 text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl p-4 w-full">
              <AlertCircle size={20} />
              {error}
            </div>
            <button 
              onClick={handleFetch}
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Card */}
      <AnimatePresence>
        {videoInfo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-900/80 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="md:flex">
              {/* Thumbnail */}
              <div className="md:w-2/5 relative aspect-video">
                <img 
                  src={videoInfo.thumbnail} 
                  alt="Thumbnail" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = `https://img.youtube.com/vi/${videoInfo.id}/hqdefault.jpg`;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                  <span className="text-white text-sm font-medium truncate mr-2">{videoInfo.author}</span>
                  {videoInfo.duration > 0 && (
                    <span className="bg-black/80 px-2 py-1 rounded text-sm font-mono text-white shrink-0">
                      {formatDuration(videoInfo.duration)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Info */}
              <div className="p-6 md:p-8 md:w-3/5 flex flex-col">
                <h2 className="text-xl md:text-2xl font-bold mb-6 line-clamp-2">{videoInfo.title}</h2>
                
                {/* Quality Grid */}
                <div className="mb-6 flex-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">
                    Available Qualities ({qualities.length})
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
                    {qualities.map((quality, index) => {
                      const badge = getQualityBadge(quality.resolution);
                      const isSelected = selectedQuality?.format_id === quality.format_id;
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedQuality(quality)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-red-600 border-red-500 text-white'
                              : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-500'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold">{quality.resolution}p</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-white/20' : badge.color
                            }`}>
                              {badge.label}
                            </span>
                            {quality.hasAudio ? (
                              <Volume2 size={14} className="opacity-60" />
                            ) : (
                              <VolumeX size={14} className="text-yellow-500" />
                            )}
                          </div>
                          <div className="text-xs opacity-60 flex items-center gap-2">
                            <span>{quality.ext?.toUpperCase() || 'MP4'}</span>
                            {quality.fps && <span>{quality.fps}fps</span>}
                            {quality.filesize && <span>{formatSize(quality.filesize)}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Download Button */}
                <button 
                  onClick={handleDownload}
                  disabled={!selectedQuality}
                  className="w-full bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors"
                >
                  <Download size={24} />
                  Download {selectedQuality?.resolution}p {selectedQuality?.ext?.toUpperCase() || 'MP4'}
                  {selectedQuality && !selectedQuality.hasAudio && (
                    <span className="text-sm opacity-60">(No Audio)</span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-24 text-center text-zinc-600 text-sm">
        <p>VibeLoader - Self-hosted YouTube Downloader</p>
        <p className="mt-2">Powered by yt-dlp</p>
      </footer>
    </div>
  );
}

export default App;
