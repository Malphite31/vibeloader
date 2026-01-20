import React, { useState } from 'react';
import { Download, Youtube, Loader2, Play, AlertCircle, RefreshCw, Film, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [qualities, setQualities] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(null);
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

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes) return '';
    const num = parseInt(bytes);
    if (isNaN(num)) return '';
    const mb = num / (1024 * 1024);
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

  // Get quality label
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
      const response = await fetch(`/api/info?v=${videoId}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Combine and process qualities
      const allQualities = [];
      
      // Add format streams (with audio) first
      if (data.formatStreams) {
        data.formatStreams.forEach(stream => {
          if (stream.resolution > 0) {
            allQualities.push({
              ...stream,
              hasAudio: true,
              priority: 1
            });
          }
        });
      }

      // Add adaptive formats (video only, higher quality)
      if (data.adaptiveFormats) {
        data.adaptiveFormats.forEach(stream => {
          if (stream.resolution > 0) {
            // Only add if we don't have this resolution with audio
            const existingWithAudio = allQualities.find(
              q => q.resolution === stream.resolution && q.hasAudio
            );
            if (!existingWithAudio) {
              allQualities.push({
                ...stream,
                hasAudio: false,
                priority: 2
              });
            }
          }
        });
      }

      // Sort by resolution (highest first), then by hasAudio (with audio first)
      allQualities.sort((a, b) => {
        if (b.resolution !== a.resolution) return b.resolution - a.resolution;
        return a.hasAudio ? -1 : 1;
      });

      // Remove duplicates, keep best version of each resolution
      const uniqueQualities = [];
      const seen = new Set();
      for (const q of allQualities) {
        const key = `${q.resolution}-${q.hasAudio}`;
        if (!seen.has(q.resolution) || (q.hasAudio && !uniqueQualities.find(uq => uq.resolution === q.resolution && uq.hasAudio))) {
          // Remove video-only if we found one with audio
          const idx = uniqueQualities.findIndex(uq => uq.resolution === q.resolution && !uq.hasAudio && q.hasAudio);
          if (idx >= 0) uniqueQualities.splice(idx, 1);
          
          if (!uniqueQualities.find(uq => uq.resolution === q.resolution)) {
            uniqueQualities.push(q);
            seen.add(q.resolution);
          }
        }
      }

      if (uniqueQualities.length === 0) {
        throw new Error('No downloadable formats available for this video');
      }

      setVideoInfo({
        id: videoId,
        title: data.title,
        author: data.author,
        thumbnail: data.thumbnail,
        duration: data.lengthSeconds,
        views: data.viewCount
      });

      setQualities(uniqueQualities);
      setSelectedQuality(uniqueQualities[0]);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not fetch video info. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!selectedQuality?.url) return;
    
    // Direct download - opens the video URL
    const link = document.createElement('a');
    link.href = selectedQuality.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
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
        <p className="text-zinc-400 text-lg">Download YouTube videos directly. No ads. No redirects.</p>
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                  <span className="text-white text-sm font-medium">{videoInfo.author}</span>
                  {videoInfo.duration > 0 && (
                    <span className="bg-black/80 px-2 py-1 rounded text-sm font-mono text-white">
                      {formatDuration(videoInfo.duration)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="p-6 md:p-8 md:w-3/5 flex flex-col">
                <h2 className="text-xl md:text-2xl font-bold mb-6 line-clamp-2">{videoInfo.title}</h2>
                
                <div className="mb-6 flex-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">
                    Available Qualities ({qualities.length})
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
                    {qualities.map((quality, index) => {
                      const badge = getQualityBadge(quality.resolution);
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedQuality(quality)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selectedQuality?.url === quality.url
                              ? 'bg-red-600 border-red-500 text-white'
                              : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-500'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold">{quality.resolution}p</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              selectedQuality?.url === quality.url ? 'bg-white/20' : badge.color
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
                            <span>{quality.container?.toUpperCase() || 'MP4'}</span>
                            {quality.fps && <span>{quality.fps}fps</span>}
                            {quality.size && <span>{formatSize(quality.size)}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button 
                  onClick={handleDownload}
                  disabled={!selectedQuality}
                  className="w-full bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors"
                >
                  <Download size={24} />
                  Download {selectedQuality?.resolution}p {selectedQuality?.container?.toUpperCase() || 'MP4'}
                  {!selectedQuality?.hasAudio && <span className="text-sm opacity-60">(No Audio)</span>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-24 text-center text-zinc-600 text-sm">
        <p>VibeLoader - Fast & Free YouTube Video Downloader</p>
        <p className="mt-2">No ads. No redirects. Direct downloads.</p>
      </footer>
    </div>
  );
}

export default App;
