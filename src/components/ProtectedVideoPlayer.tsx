import React, { useEffect, useRef, useState } from 'react';
import {
  Lock,
  Maximize2,
  Pause,
  Play,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { auth } from '../firebase';
import { formatNaira } from '../types';

interface ProtectedVideoPlayerProps {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  videoId: string;
  isFreeIntro: boolean;
  hasAccess: boolean;
  coursePrice: number;
  sessionId: string;
  viewerLabel: string;
  onPurchaseClick: () => void;
  onSessionInvalidated?: (reason: string) => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const ProtectedVideoPlayer: React.FC<ProtectedVideoPlayerProps> = ({
  courseId,
  lessonId,
  lessonTitle,
  videoId,
  isFreeIntro,
  hasAccess,
  coursePrice,
  sessionId,
  viewerLabel,
  onPurchaseClick,
  onSessionInvalidated,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const canWatch = isFreeIntro || hasAccess;

  useEffect(() => {
    let cancelled = false;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setStreamUrl(null);
    setErrorMsg(null);

    if (!canWatch || !videoId) return;

    async function fetchPlaybackToken() {
      setLoading(true);
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        };
        const currentUser = auth.currentUser;
        if (currentUser) {
          const idToken = await currentUser.getIdToken();
          headers.Authorization = `Bearer ${idToken}`;
        }

        const resp = await fetch('/api/videos/playback-token', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            videoId,
            courseId,
            lessonId,
            isFreeIntro,
          }),
        });

        const data = (await resp.json()) as { streamUrl?: string; error?: string };
        if (cancelled) return;

        if (resp.status === 409 && onSessionInvalidated) {
          onSessionInvalidated(data.error || 'Another device logged into this account.');
          return;
        }

        if (!resp.ok || !data.streamUrl) {
          setErrorMsg(data.error || 'Unable to authorize protected stream.');
          return;
        }

        setStreamUrl(data.streamUrl);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Network error loading protected video.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchPlaybackToken();
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId, videoId, isFreeIntro, canWatch, sessionId, onSessionInvalidated]);

  // Block Save/Source shortcuts when interacting with the theater
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'u')) {
        if (containerRef.current?.contains(document.activeElement) || isPlaying) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const togglePlay = async () => {
    const el = videoRef.current;
    if (!el || !streamUrl) return;
    if (el.paused) {
      try {
        await el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setIsMuted(el.muted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const nextTime = Number(e.target.value);
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      await container.requestFullscreen().catch(() => undefined);
    } else {
      await document.exitFullscreen().catch(() => undefined);
    }
  };

  if (!canWatch) {
    return (
      <div className="min-h-[260px] sm:min-h-0 sm:aspect-video w-full bg-[#0F172A] rounded-xl border border-slate-800 flex flex-col items-center justify-center p-5 sm:p-8 text-center">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-800/90 flex items-center justify-center mb-3 sm:mb-4 text-amber-400">
          <Lock className="w-5 h-5" />
        </div>
        <p className="text-xs font-mono-tabular text-slate-400 mb-1.5 sm:mb-2">
          Enrolled Lesson · Purchase Required
        </p>
        <h3 className="font-display text-lg sm:text-xl text-white font-semibold max-w-md mb-2">
          {lessonTitle}
        </h3>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mb-5 sm:mb-6 leading-relaxed">
          The introduction video is free to preview. Purchase this course to stream all full lessons on LAW STEAD.
        </p>
        <button
          type="button"
          onClick={onPurchaseClick}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 text-sm font-semibold text-[#0F172A] bg-white rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
        >
          Buy Full Course · {formatNaira(coursePrice)}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className="protected-video-surface relative aspect-video w-full bg-[#0B1120] rounded-xl overflow-hidden border border-slate-800 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-xs sm:text-sm gap-2 z-20 bg-[#0B1120] px-4 text-center">
          <div className="w-6 h-6 border-2 border-slate-500 border-t-white rounded-full animate-spin" />
          <span>Authorizing protected stream...</span>
        </div>
      )}

      {errorMsg && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 sm:p-6 z-20 bg-[#0B1120]">
          <p className="text-xs sm:text-sm text-red-300 max-w-md mb-4">{errorMsg}</p>
        </div>
      )}

      {streamUrl && (
        <video
          ref={videoRef}
          src={streamUrl}
          controls={false}
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          disableRemotePlayback
          playsInline
          preload="metadata"
          onClick={() => void togglePlay()}
          onContextMenu={(e) => e.preventDefault()}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setIsPlaying(false)}
          className="w-full h-full object-contain cursor-pointer"
        />
      )}

      {/* Protective invisible overlay preventing mobile long-press save on video element */}
      <div
        aria-hidden="true"
        onClick={() => void togglePlay()}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-x-0 top-0 bottom-14 z-10"
      />

      {/* Top Watermark & Anti-Download Notice */}
      <div className="pointer-events-none absolute top-2.5 sm:top-3 inset-x-2.5 sm:inset-x-4 z-20 flex items-center justify-between gap-2 sm:gap-4 text-[10px] sm:text-[11px] font-mono-tabular text-white/65">
        <span className="truncate bg-black/45 px-2 py-1 rounded max-w-full">
          {viewerLabel} · Protected Stream
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5 bg-black/45 px-2.5 py-1 rounded shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
          Stream-Only · Downloads Disabled
        </span>
      </div>

      {/* Center Play Overlay when paused */}
      {streamUrl && !loading && !isPlaying && (
        <button
          type="button"
          onClick={() => void togglePlay()}
          aria-label="Play lesson video"
          className="absolute inset-0 m-auto z-20 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/95 text-[#0F172A] flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
        >
          <Play className="w-6 h-6 ml-0.5" />
        </button>
      )}

      {/* Custom Player Controls (zero native download affordances) */}
      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-2.5 sm:px-4 pt-5 pb-2.5 sm:pt-6 sm:pb-3 flex items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-10 h-10 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-white hover:bg-white/15 transition-colors shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.25}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Seek video progress"
          className="flex-1 min-w-0 h-2 sm:h-1.5 accent-white cursor-pointer"
        />

        <span className="text-[11px] sm:text-xs font-mono-tabular text-slate-200 whitespace-nowrap shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="w-10 h-10 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-white hover:bg-white/15 transition-colors shrink-0"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label="Fullscreen"
          className="w-10 h-10 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-white hover:bg-white/15 transition-colors shrink-0"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
