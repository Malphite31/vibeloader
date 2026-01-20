import React, { useState } from 'react';
import { Download, Youtube, Loader2, Play, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Piped API instances for direct calls (with CORS support)
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.in.projectsegfau.lt',
  'https://api.piped.yt'
];

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [availableQualities, setAvailableQualities] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [error, setError] = useState('');

  // Extract video ID from YouTube URL
  const extractVideoId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
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
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
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

  // Fetch video info with fallback instances
  const fetchVideoInfo = async (videoId) => {
    // Try local API first (Cloudflare Functions)
    try {
      const localRes = await fetch(`/api/info?v=${videoId}`);
      if (localRes.ok) {
        return await localRes.json();
      }
    } catch (e) {
      console.log('Local API not available, trying external...');
    }

    // Fallback to direct Piped API calls
    for (const instance of PIPED_INSTANCES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(`${instance}/streams/${videoId}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          return await response.json();
        }
      } catch (err) {
        console.log(`Failed with ${instance}, trying next...`);
      }
    }
    throw new Error('All API instances failed');
  };

  const handleFetch = async (e) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    setError('');
    setVideoInfo(null);
    setAvailableQualities([]);
    setSelectedQuality(null);

    const videoId = extractVideoId(url);
    
    if (!videoId) {
      setError('Please enter a valid YouTube URL');
      setLoading(false);
      return;
    }

    try {
      const data = await fetchVideoInfo(videoId);
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Get video streams (with audio combined)
      const videoStreams = data.videoStreams || [];
      
      // Process and filter streams
      const qualities = videoStreams
        .filter(stream => {
          // Prefer streams with audio, or MP4 format
          return !stream.videoOnly && stream.mimeType?.includes('video');
        })
        .map(stream => ({
          url: stream.url,
          quality: stream.quality,
          resolution: parseInt(stream.quality) || 0,
          format: stream.mimeType?.includes('mp4') ? 'MP4' : 'WEBM',
          mimeType: stream.mimeType,
          size: stream.contentLength,
          fps: stream.fps,
          codec: stream.codec
        }))
        .filter(q => q.resolution > 0)
        .sort((a, b) => b.resolution - a.resolution);

      // Remove duplicates, keep best for each resolution
      const uniqueQualities = [];
      const seenResolutions = new Set();
      for (const q of qualities) {
        if (!seenResolutions.has(q.resolution)) {
          seenResolutions.add(q.resolution);
          uniqueQualities.push(q);
        }
      }

      // If no combined streams, try video-only streams
      if (uniqueQualities.length === 0) {
        const videoOnlyStreams = videoStreams
          .filter(stream => stream.videoOnly && stream.mimeType?.includes('video'))
          .map(stream => ({
            url: stream.url,
            quality: stream.quality,
            resolution: parseInt(stream.quality) || 0,
            format: stream.mimeType?.includes('mp4') ? 'MP4' : 'WEBM',
            mimeType: stream.mimeType,
            size: stream.contentLength,
            fps: stream.fps,
            codec: stream.codec,
            videoOnly: true
          }))
          .filter(q => q.resolution > 0)
          .sort((a, b) => b.resolution - a.resolution);

        for (const q of videoOnlyStreams) {
          if (!seenResolutions.has(q.resolution)) {
            seenResolutions.add(q.resolution);
            uniqueQualities.push(q);
          }
        }
      }

      if (uniqueQualities.length === 0) {
        throw new Error('No downloadable formats found for this video');
      }

      setVideoInfo({
        id: videoId,
        title: data.title,
        thumbnail: data.thumbnailUrl,
        author: data.uploader,
        duration: data.duration,
        views: data.views
      });

      setAvailableQualities(uniqueQualities);
      setSelectedQuality(uniqueQualities[0]);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not fetch video info. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!selectedQuality || !videoInfo) return;
    
    setDownloading(true);
    
    // Open stream URL in new tab (triggers download)
    window.open(selectedQuality.url, '_blank');
    
    setTimeout(() => setDownloading(false), 2000);
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
        <p className="text-zinc-400 text-lg">Download YouTube videos in the best available quality.</p>
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
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Fetch'}
          </button>
        </form>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center gap-2 text-red-500 text-center mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4"
          >
            <AlertCircle size={20} />
            {error}
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
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Play size={48} className="text-white opacity-80" />
                </div>
                {videoInfo.duration > 0 && (
                  <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-sm font-mono">
                    {formatDuration(videoInfo.duration)}
                  </div>
                )}
              </div>
              <div className="p-6 md:p-8 md:w-3/5 flex flex-col justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold mb-2 line-clamp-2">{videoInfo.title}</h2>
                  <p className="text-zinc-500 mb-6">{videoInfo.author}</p>
                  
                  <div className="mb-6">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">
                      Available Qualities ({availableQualities.length})
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {availableQualities.map((quality, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedQuality(quality)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selectedQuality?.resolution === quality.resolution
                              ? 'bg-red-600 border-red-500 text-white'
                              : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-500'
                          }`}
                        >
                          <div className="font-bold text-sm flex items-center gap-1">
                            {quality.resolution}p
                            {quality.resolution >= 2160 && <span className="text-xs opacity-70">4K</span>}
                            {quality.resolution === 1440 && <span className="text-xs opacity-70">2K</span>}
                            {quality.videoOnly && <span className="text-xs text-yellow-500">*</span>}
                          </div>
                          <div className="text-xs opacity-60 mt-1">
                            {quality.format}
                            {quality.fps && ` • ${quality.fps}fps`}
                            {quality.size && ` • ${formatSize(quality.size)}`}
                          </div>
                        </button>
                      ))}
                    </div>
                    {availableQualities.some(q => q.videoOnly) && (
                      <p className="text-xs text-zinc-500 mt-2">* Video only (no audio)</p>
                    )}
                  </div>
                </div>

                <button 
                  onClick={handleDownload}
                  disabled={downloading || !selectedQuality}
                  className="w-full bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-700 disabled:text-zinc-500 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-colors"
                >
                  {downloading ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      Starting Download...
                    </>
                  ) : (
                    <>
                      <Download size={24} />
                      Download {selectedQuality?.resolution}p {selectedQuality?.format}
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
