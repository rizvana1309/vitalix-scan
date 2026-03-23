import { useState, useRef, useCallback, useEffect } from 'react';
import {
  analyzeHeartSignal,
  calculateFinalBpm,
  type HeartSignalSample,
} from '@/lib/heartRateSignal';

export interface SignalPoint {
  time: number;
  value: number;
  isPeak: boolean;
}

export interface HeartRateReading {
  bpm: number;
  timestamp: Date;
}

export type DetectionStatus =
  | 'idle'
  | 'starting'
  | 'detecting'
  | 'stable'
  | 'adjusting'
  | 'hold-steady'
  | 'no-finger'
  | 'error';

// ─── Configuration ───
const SAMPLE_BUFFER_SIZE = 600;       // ~20s at 30fps
const BPM_UPDATE_INTERVAL = 2000;     // update every 2s for stability
const AUTO_STOP_DURATION = 45000;     // 45s measurement cycle
const MIN_STABLE_READINGS = 3;
const MIN_SIGNAL_SECONDS = 6;
const STABLE_BPM_SPREAD = 8;

// Finger detection thresholds — tuned to be more forgiving
const MIN_RED_INTENSITY = 60;         // lower for more sensitivity
const MIN_RED_GREEN_RATIO = 1.05;     // relaxed ratio
const MIN_FINGER_COVERAGE = 0.25;     // 25% of pixels must look like skin
const NO_FINGER_DEBOUNCE = 25;        // frames before declaring no-finger
const SIGNAL_WARMUP_FRAMES = 15;      // ignore first N frames (camera settling)

// Rolling BPM smoother
const ROLLING_BPM_WINDOW = 3;

export function useHeartRateDetection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const [status, setStatus] = useState<DetectionStatus>('idle');
  const [bpm, setBpm] = useState<number | null>(null);
  const [signalData, setSignalData] = useState<SignalPoint[]>([]);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [flashSupported, setFlashSupported] = useState(true);
  const [readings, setReadings] = useState<HeartRateReading[]>([]);
  const [measurementComplete, setMeasurementComplete] = useState(false);
  const [finalBpm, setFinalBpm] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [signalQuality, setSignalQuality] = useState(0);

  const rawSignalRef = useRef<HeartSignalSample[]>([]);
  const fpsRef = useRef(30);
  const lastBpmUpdateRef = useRef(0);
  const startTimeRef = useRef(0);
  const stableCountRef = useRef(0);
  const bpmHistoryRef = useRef<number[]>([]);
  const rollingBpmRef = useRef<number[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noFingerFramesRef = useRef(0);
  const fingerDetectedRef = useRef(false);
  const liveBpmRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const prevRedRef = useRef(0);

  useEffect(() => {
    liveBpmRef.current = bpm;
  }, [bpm]);

  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      trackRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const finalizeMeasurement = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    stopMediaStream();

    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const result = calculateFinalBpm(
      bpmHistoryRef.current,
      liveBpmRef.current,
      rawSignalRef.current,
      fpsRef.current,
    );

    if (result && elapsed >= MIN_SIGNAL_SECONDS) {
      setFinalBpm(result);
      setBpm(result);
      setReadings(prev => [...prev, { bpm: result, timestamp: new Date() }].slice(-5));
    } else {
      setFinalBpm(null);
    }

    setMeasurementComplete(true);
    setProgress(100);
    setStatus('idle');
    setFlashEnabled(false);
  }, [stopMediaStream]);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    frameCountRef.current++;

    // Sample a small center region for performance
    const w = 48;
    const h = 48;
    canvas.width = w;
    canvas.height = h;

    // Draw center crop of video
    const vw = video.videoWidth || 320;
    const vh = video.videoHeight || 240;
    const cropSize = Math.min(vw, vh) * 0.5;
    const sx = (vw - cropSize) / 2;
    const sy = (vh - cropSize) / 2;
    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;

    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let fingerPixels = 0;
    const totalPixels = w * h;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      redSum += r;
      greenSum += g;
      blueSum += b;
      // Finger pixel: red dominant, warm tone
      if (r > 50 && r > g * 1.05 && r > b * 1.1) {
        fingerPixels++;
      }
    }

    const avgRed = redSum / totalPixels;
    const avgGreen = greenSum / totalPixels;
    const avgBlue = blueSum / totalPixels;
    const redGreenRatio = avgRed / Math.max(avgGreen, 1);
    const fingerCoverage = fingerPixels / totalPixels;

    const now = performance.now();
    const elapsed = (now - startTimeRef.current) / 1000;

    // FPS tracking
    if (lastFrameTimeRef.current > 0) {
      const frameDt = (now - lastFrameTimeRef.current) / 1000;
      if (frameDt > 0.005 && frameDt < 0.2) {
        fpsRef.current = 0.9 * fpsRef.current + 0.1 * (1 / frameDt);
      }
    }
    lastFrameTimeRef.current = now;

    // ─── Finger detection (relaxed & debounced) ───
    const rgbVariance = Math.abs(avgRed - avgGreen) + Math.abs(avgRed - avgBlue);
    const hasFinger =
      avgRed >= MIN_RED_INTENSITY &&
      redGreenRatio >= MIN_RED_GREEN_RATIO &&
      fingerCoverage >= MIN_FINGER_COVERAGE &&
      rgbVariance > 5; // some color variance = real signal, not black

    if (!hasFinger) {
      noFingerFramesRef.current++;

      if (noFingerFramesRef.current >= NO_FINGER_DEBOUNCE && frameCountRef.current > SIGNAL_WARMUP_FRAMES) {
        if (fingerDetectedRef.current) {
          // Was working, now lost → "hold steady"
          setStatus('hold-steady');
        } else {
          setStatus('no-finger');
        }
        stableCountRef.current = 0;
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Finger detected
    noFingerFramesRef.current = 0;
    fingerDetectedRef.current = true;

    if (frameCountRef.current <= SIGNAL_WARMUP_FRAMES) {
      // Still warming up
      prevRedRef.current = avgRed;
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Restore status from no-finger/hold-steady
    if (status === 'no-finger' || status === 'hold-steady') {
      setStatus('detecting');
    }

    // ─── PPG Signal: use red/green ratio (exposure-invariant) ───
    const signalValue = redGreenRatio;
    const signal = rawSignalRef.current;
    signal.push({ value: signalValue, time: elapsed });

    if (signal.length > SAMPLE_BUFFER_SIZE) {
      signal.splice(0, signal.length - SAMPLE_BUFFER_SIZE);
    }

    prevRedRef.current = avgRed;

    // ─── BPM update every 2 seconds ───
    if (now - lastBpmUpdateRef.current >= BPM_UPDATE_INTERVAL && signal.length >= 45) {
      lastBpmUpdateRef.current = now;

      const analysis = analyzeHeartSignal(signal, fpsRef.current);

      // Update signal quality (0-100)
      const quality = Math.round(analysis.confidence * 100);
      setSignalQuality(quality);

      // Build waveform visualization (last ~5 seconds)
      const visCount = Math.round(fpsRef.current * 5);
      const visStart = Math.max(0, analysis.filtered.length - visCount);
      const peakSet = new Set(analysis.peakIndices.filter(p => p >= visStart));
      const visData: SignalPoint[] = [];
      for (let i = visStart; i < analysis.filtered.length; i++) {
        visData.push({
          time: parseFloat(signal[i].time.toFixed(2)),
          value: parseFloat(analysis.filtered[i].toFixed(4)),
          isPeak: peakSet.has(i),
        });
      }
      setSignalData(visData);

      if (analysis.bpm && analysis.confidence >= 0.3) {
        // Rolling average of last N BPM readings for stability
        rollingBpmRef.current.push(analysis.bpm);
        if (rollingBpmRef.current.length > ROLLING_BPM_WINDOW) {
          rollingBpmRef.current.shift();
        }
        const smoothedBpm = Math.round(
          rollingBpmRef.current.reduce((a, b) => a + b, 0) / rollingBpmRef.current.length
        );

        setBpm(smoothedBpm);
        bpmHistoryRef.current.push(smoothedBpm);
        if (bpmHistoryRef.current.length > 25) {
          bpmHistoryRef.current.splice(0, bpmHistoryRef.current.length - 25);
        }

        // Check stability
        const recent = bpmHistoryRef.current.slice(-4);
        if (recent.length >= MIN_STABLE_READINGS) {
          const spread = Math.max(...recent) - Math.min(...recent);
          if (spread <= STABLE_BPM_SPREAD && analysis.confidence >= 0.4) {
            stableCountRef.current = Math.min(stableCountRef.current + 1, MIN_STABLE_READINGS + 3);
          } else {
            stableCountRef.current = Math.max(0, stableCountRef.current - 1);
          }
        }

        setStatus(stableCountRef.current >= MIN_STABLE_READINGS ? 'stable' : 'detecting');
      } else if (elapsed >= 5 && analysis.confidence < 0.25) {
        // Low confidence but finger is present → adjusting
        setStatus('adjusting');
        stableCountRef.current = 0;
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [status]);

  const startDetection = useCallback(async () => {
    setStatus('starting');
    setBpm(null);
    setSignalData([]);
    setMeasurementComplete(false);
    setFinalBpm(null);
    setProgress(0);
    setSignalQuality(0);
    rawSignalRef.current = [];
    stableCountRef.current = 0;
    bpmHistoryRef.current = [];
    rollingBpmRef.current = [];
    noFingerFramesRef.current = 0;
    fingerDetectedRef.current = false;
    frameCountRef.current = 0;
    lastFrameTimeRef.current = 0;
    prevRedRef.current = 0;

    stopMediaStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 30, min: 15 },
        },
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // Enable torch/flash
      try {
        const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        if (caps?.torch) {
          await track.applyConstraints({ advanced: [{ torch: true } as any] });
          setFlashEnabled(true);
          setFlashSupported(true);
        } else {
          setFlashEnabled(false);
          setFlashSupported(false);
        }
      } catch {
        setFlashEnabled(false);
        setFlashSupported(false);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      startTimeRef.current = performance.now();
      lastBpmUpdateRef.current = 0;
      fpsRef.current = 30;
      setStatus('detecting');
      animFrameRef.current = requestAnimationFrame(processFrame);

      // Progress timer
      const startMs = Date.now();
      progressIntervalRef.current = setInterval(() => {
        const pct = Math.min(((Date.now() - startMs) / AUTO_STOP_DURATION) * 100, 100);
        setProgress(Math.round(pct));
      }, 500);

      // Auto-stop
      autoStopTimerRef.current = setTimeout(() => {
        finalizeMeasurement();
      }, AUTO_STOP_DURATION);
    } catch (err) {
      console.error('Camera access failed:', err);
      setStatus('error');
      stopMediaStream();
    }
  }, [processFrame, finalizeMeasurement, stopMediaStream]);

  const stopDetection = useCallback(() => {
    finalizeMeasurement();
  }, [finalizeMeasurement]);

  const resetMeasurement = useCallback(() => {
    setMeasurementComplete(false);
    setFinalBpm(null);
    setProgress(0);
    setBpm(null);
    setSignalData([]);
    setSignalQuality(0);
    setStatus('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stopMediaStream();
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [stopMediaStream]);

  const averageBpm = readings.length > 0
    ? Math.round(readings.reduce((s, r) => s + r.bpm, 0) / readings.length)
    : null;

  const classifyBpm = (value: number): { label: string; color: 'success' | 'warning' | 'destructive' } => {
    if (value < 60) return { label: 'Low', color: 'warning' };
    if (value <= 100) return { label: 'Normal', color: 'success' };
    return { label: 'High', color: 'destructive' };
  };

  return {
    videoRef,
    canvasRef,
    status,
    bpm,
    signalData,
    flashEnabled,
    flashSupported,
    readings,
    averageBpm,
    measurementComplete,
    finalBpm,
    progress,
    signalQuality,
    startDetection,
    stopDetection,
    resetMeasurement,
    classifyBpm,
  };
}
