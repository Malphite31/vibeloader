import React, { useState } from 'react';
import { Download, Youtube, Loader2, Play, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Quality options for user selection
const QUALITY_OPTIONS = [
  { value: '2160', label: '4K', tag: 'Ultra HD' },
  { value: '1440', label: '1440p', tag: '2K' },
  { value: '1080', label: '1080p', tag: 'Full HD' },
  { value: '720', label: '720p', tag: 'HD' },
  { value: '480', label: '480p', tag: 'SD' },
  { value: '360', label: '360p', tag: 'Low' }
];

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState('1080');
  const [error, setError] = useState('');

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

  const handleFetch = async (e) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    setError('');
    setVideoInfo(null);

    const videoId = extractVideoId(url);
    
    if (!videoId) {
      setError('Please enter a valid YouTube URL');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/info?v=${videoId}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setVideoInfo({
        id: videoId,
        title: data.title,
        thumbnail: data.thumbnailUrl,
        author: data.uploader,
        cobaltData: data.cobaltData,
        fallback: data.fallback
      });

    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not fetch video info. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!videoInfo) return;
    
    setDownloading(true);
    setError('');

    try {
      // If we have cobalt data with direct URL
      if (videoInfo.cobaltData?.url) {
        window.open(videoInfo.cobaltData.url, '_blank');
        setDownloading(false);
        return;
      }

      // Otherwise use cobalt API directly with selected quality
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoInfo.id,
          quality: selectedQuality
        })
      });

      const data = await response.json();

      if (data.url) {
        window.open(data.url, '_blank');
      } else if (data.fallbackUrl) {
        window.open(data.fallbackUrl, '_blank');
      } else {
        throw new Error(data.error || 'Download failed');
      }

    } catch (err) {
      // Fallback to external service
      const fallbackUrl = `https://ssyoutube.com/watch?v=${videoInfo.id}`;
      window.open(fallbackUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-24">
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
        <p className="text-zinc-400 text-lg">Download YouTube videos in high quality.</p>
      </motion.div>

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

        {videoInfo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-900/80 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="md:flex">
              <div className="md:w-2/5 relative aspect-video">
                <img 
                  src={videoInfo.thumbnail} 
                  alt="Thumbnail" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = `https://img.youtube.com/vi/${videoInfo.id}/hqdefault.jpg`;
                  }}
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Play size={48} className="text-white opacity-80" />
                </div>
              </div>
              <div className="p-6 md:p-8 md:w-3/5 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold mb-2 line-clamp-2">{videoInfo.title}</h2>
                  <p className="text-zinc-500 mb-6">{videoInfo.author}</p>
                  
                  <div className="mb-6">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">
                      Select Quality
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {QUALITY_OPTIONS.map((quality) => (
                        <button
                          key={quality.value}
                          onClick={() => setSelectedQuality(quality.value)}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            selectedQuality === quality.value
                              ? 'bg-red-600 border-red-500 text-white'
                              : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-500'
                          }`}
                        >
                          <div className="font-bold text-sm">{quality.label}</div>
                          <div className="text-xs opacity-60">{quality.tag}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Download size={24} />
                      Download {QUALITY_OPTIONS.find(q => q.value === selectedQuality)?.label} MP4
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-24 text-center text-zinc-600 text-sm">
        <p>VibeLoader - Fast & Free YouTube Video Downloader</p>
        <p className="mt-2">Powered by Cloudflare Pages</p>
      </footer>
    </div>
  );
}

export default App;
