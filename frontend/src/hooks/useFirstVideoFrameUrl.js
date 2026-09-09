import { useEffect, useState } from 'react';

/**
 * Renders a video frame to a small JPEG "data" URL (thumbnail for scenario cards).
 * Uses a detached video element; same-origin assets avoid "crossOrigin" so canvas is not tainted.
 */
function installCrossOriginIfNeeded(video, videoUrl) {
  try {
    const abs = new URL(videoUrl, window.location.href);
    if (abs.origin !== window.location.origin) {
      video.crossOrigin = 'anonymous';
    }
  } catch {
    // relative URL — same document origin
  }
}

export function useFirstVideoFrameUrl(videoUrl) {
  const [state, setState] = useState({
    status: 'idle',
    imageUrl: null,
  });

  useEffect(() => {
    let cancelled = false;
    if (!videoUrl) {
      queueMicrotask(() => {
        if (!cancelled) setState({ status: 'idle', imageUrl: null });
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) setState({ status: 'loading', imageUrl: null });
    });

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    installCrossOriginIfNeeded(video, videoUrl);

    const captureToJpeg = () => {
      if (cancelled) return true;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        setState({ status: 'error', imageUrl: null });
        return true;
      }
      try {
        const canvas = document.createElement('canvas');
        const maxSide = 160;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        canvas.width = Math.max(1, Math.floor(w * scale));
        canvas.height = Math.max(1, Math.floor(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setState({ status: 'error', imageUrl: null });
          return true;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (!cancelled) setState({ status: 'ready', imageUrl: canvas.toDataURL('image/jpeg', 0.85) });
        return true;
      } catch {
        if (!cancelled) setState({ status: 'error', imageUrl: null });
        return true;
      }
    };

    let fallbackTimer = null;
    let finished = false;

    const onError = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      finished = true;
      if (!cancelled) setState({ status: 'error', imageUrl: null });
    };

    const finishOnce = () => {
      if (finished) return;
      finished = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      captureToJpeg();
    };

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      finishOnce();
    };

    const onLoadedData = () => {
      video.removeEventListener('loadeddata', onLoadedData);
      // Slight positive seek so "seeked" fires and a keyframe decodes (≈ first frame for cover)
      video.addEventListener('seeked', onSeeked);
      const t = 0.01;
      const target =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(t, Math.max(0, video.duration - 1e-3))
          : t;
      try {
        video.currentTime = target;
      } catch {
        onError();
      }
    };

    // If "seeked" never runs, try a late capture (rare short/odd encodes)
    fallbackTimer = window.setTimeout(() => {
      if (cancelled || finished) return;
      video.removeEventListener('seeked', onSeeked);
      finishOnce();
    }, 2000);

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('error', onError, { once: true });
    video.src = videoUrl;

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeAttribute('src');
      video.load();
    };
  }, [videoUrl]);

  return state;
}
