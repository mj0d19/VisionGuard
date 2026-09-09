import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import DemoAnalyzeOverlay from './DemoAnalyzeOverlay';

/** Isolated video + error state remounts when `src` changes (no effect-based reset). */
function VideoSurface({ src, isAnalyzing, videoRef, noSignalLabel, videoNotSupportedLabel, onPlaybackReadyChange }) {
  const [videoError, setVideoError] = useState(false);
  const showVideo = Boolean(src) && !videoError;

  useEffect(() => {
    if (!src) {
      onPlaybackReadyChange?.(false);
      return;
    }
    // Wait for a successful load before treating the source as playable (avoids shimmer when file 404s).
    onPlaybackReadyChange?.(false);
  }, [src, onPlaybackReadyChange]);

  if (!showVideo) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-vg-text-muted gap-2 p-8">
        <svg className="w-14 h-14 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm text-center">{noSignalLabel}</p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-300 ${
        isAnalyzing ? 'demo-video-analyzing' : 'opacity-100'
      }`}
      controls
      loop
      muted
      playsInline
      preload="metadata"
      onLoadedData={() => {
        setVideoError(false);
        onPlaybackReadyChange?.(true);
      }}
      onError={() => {
        setVideoError(true);
        onPlaybackReadyChange?.(false);
      }}
    >
      <source src={src} type="video/mp4" />
      {videoNotSupportedLabel}
    </video>
  );
}

/**
 * Imperative controls for the demo hero video (timeline jump-to, etc.).
 * @typedef {{ seekToSeconds: (seconds: number) => void; play: () => void }} DemoPlayerHandle
 */

/**
 * Hero video region with title, optional video, analyze/reset actions, and analyze overlay.
 */
const DemoPlayer = forwardRef(function DemoPlayer(
  {
    title,
    rawVideoSrc,
    analyzedVideoSrc,
    isAnalyzing,
    isAnalyzed,
    analyzeStepLabels,
    activeAnalyzeStepIndex,
    onAnalyze,
    onReset,
    onReplay,
    analyzeLabel,
    resetLabel,
    replayLabel,
    completeLabel,
    noSignalLabel,
    videoNotSupportedLabel,
    activeScenarioLabel,
    onVideoPlaybackReadyChange,
    onPlaybackTimeUpdate,
    /** Fires once per analyzed clip when playback reaches the end (handles looping via time threshold). */
    onPlaybackReachedEnd,
    videoStableKey,
    showAnalyzeCompleteImage,
    analyzeCompleteImageAlt,
  },
  ref
) {
  const videoRef = useRef(null);
  const currentVideoSrc = isAnalyzed ? analyzedVideoSrc : rawVideoSrc;
  const showVideo = Boolean(currentVideoSrc);

  useImperativeHandle(
    ref,
    () => ({
      seekToSeconds(seconds) {
        const el = videoRef.current;
        if (!el || !Number.isFinite(seconds)) return;
        const max = Number.isFinite(el.duration) ? el.duration : seconds;
        el.currentTime = Math.max(0, Math.min(seconds, max));
      },
      play() {
        const el = videoRef.current;
        if (!el) return;
        const p = el.play();
        if (p?.catch) p.catch(() => {});
      },
    }),
    []
  );

  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.currentTime = 0;
      el.load();
      const playPromise = el.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    }
  }, [currentVideoSrc]);

  // Drive demo timeline unlock from actual playback position (and seeks).
  useEffect(() => {
    if (!onPlaybackTimeUpdate || !showVideo) return undefined;
    const el = videoRef.current;
    if (!el) return undefined;
    const notify = () => onPlaybackTimeUpdate(el.currentTime);
    el.addEventListener('timeupdate', notify);
    el.addEventListener('seeked', notify);
    notify();
    return () => {
      el.removeEventListener('timeupdate', notify);
      el.removeEventListener('seeked', notify);
    };
  }, [onPlaybackTimeUpdate, showVideo, currentVideoSrc, videoStableKey]);

  // Unlock executive summary only after the user reaches end of the analyzed clip.
  useEffect(() => {
    if (!isAnalyzed || !onPlaybackReachedEnd || !showVideo) return undefined;
    const el = videoRef.current;
    if (!el) return undefined;
    let reported = false;
    const notify = () => {
      if (reported) return;
      onPlaybackReachedEnd();
      reported = true;
    };
    const onEnded = () => notify();
    const maybeNearEnd = () => {
      const d = el.duration;
      if (Number.isFinite(d) && d > 0 && el.currentTime >= d - 0.25) notify();
    };
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', maybeNearEnd);
    el.addEventListener('seeked', maybeNearEnd);
    return () => {
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', maybeNearEnd);
      el.removeEventListener('seeked', maybeNearEnd);
    };
  }, [isAnalyzed, onPlaybackReachedEnd, showVideo, currentVideoSrc, videoStableKey]);

  return (
    <div className="demo-panel demo-panel--hero flex flex-col min-h-0 flex-1">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-vg-text-muted mb-1">{activeScenarioLabel}</p>
          <h2 className="text-xl md:text-2xl font-bold text-white leading-tight">{title}</h2>
        </div>
        {isAnalyzed && (
          <span className="demo-complete-badge self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-vg-success/20 text-vg-success border border-vg-success/30">
            <span className="w-1.5 h-1.5 rounded-full bg-vg-success" />
            {completeLabel}
          </span>
        )}
      </div>

      <div className="relative flex-1 min-h-[280px] lg:min-h-[360px] rounded-xl overflow-hidden bg-black border border-white/10 demo-hero-frame">
        <div key={`${currentVideoSrc ?? 'none'}-${videoStableKey ?? 'default'}`} className="absolute inset-0 demo-video-fade-in">
          <VideoSurface
            key={`${currentVideoSrc ?? 'none'}-${videoStableKey ?? 'default'}`}
            src={currentVideoSrc}
            isAnalyzing={isAnalyzing}
            videoRef={videoRef}
            noSignalLabel={noSignalLabel}
            videoNotSupportedLabel={videoNotSupportedLabel}
            onPlaybackReadyChange={onVideoPlaybackReadyChange}
          />
        </div>

        <DemoAnalyzeOverlay
          visible={isAnalyzing || showAnalyzeCompleteImage}
          showCompleteImage={Boolean(showAnalyzeCompleteImage) && !isAnalyzing}
          activeStepIndex={activeAnalyzeStepIndex}
          stepLabels={analyzeStepLabels}
          completeImageAlt={analyzeCompleteImageAlt}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        <div className="demo-hero-cta-wrap flex-1 sm:flex-none min-w-0">
          <button
            type="button"
            disabled={isAnalyzing || showAnalyzeCompleteImage}
            onClick={onAnalyze}
            className="btn-demo inline-flex w-full items-center justify-center px-8 py-3.5"
          >
            {analyzeLabel}
          </button>
        </div>
        <div className="flex gap-2 sm:ms-auto">
          <button
            type="button"
            disabled={isAnalyzing || showAnalyzeCompleteImage}
            onClick={onReset}
            className="demo-secondary-btn px-5 py-3 rounded-lg text-sm font-medium flex-1 sm:flex-none"
          >
            {resetLabel}
          </button>
          <button
            type="button"
            disabled={isAnalyzing || !showVideo || showAnalyzeCompleteImage}
            onClick={() => {
              const el = videoRef.current;
              if (el) {
                el.currentTime = 0;
                void el.play();
              }
              onReplay?.();
            }}
            className="demo-secondary-btn px-5 py-3 rounded-lg text-sm font-medium flex-1 sm:flex-none disabled:opacity-40"
          >
            {replayLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

export default DemoPlayer;
