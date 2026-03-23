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

export type DetectionStatus = 'idle' | 'starting' | 'detecting' | 'stable' | 'low-signal' | 'no-finger' | 'error';

const SAMPLE_BUFFER_SIZE = 450; // keep ~15s at 30fps for final fallback analysis
const BPM_UPDATE_INTERVAL = 1500;
const AUTO_STOP_DURATION = 45000;
const MIN_STABLE_READINGS = 3;
const MIN_SIGNAL_SECONDS = 8;
const MIN_RED_THRESHOLD = 35;
const MIN_RED_GREEN_RATIO = 1.08;
const FINGER_COVERAGE_THRESHOLD = 0.32;
const NO_FINGER_FRAME_THRESHOLD = 18;
const STABLE_BPM_SPREAD = 6;

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

  const rawSignalRef = useRef<{ value: number; time: number }[]>([]);
  const fpsRef = useRef(30);
  const lastBpmUpdateRef = useRef(0);
  const startTimeRef = useRef(0);
  const stableCountRef = useRef(0);
  const bpmHistoryRef = useRef<number[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noFingerFramesRef = useRef(0);
  const wasNoFingerRef = useRef(false);
  const liveBpmRef = useRef<number | null>(null);

  useEffect(() => {
    liveBpmRef.current = bpm;
  }, [bpm]);

  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      trackRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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

    const elapsedSeconds = (performance.now() - startTimeRef.current) / 1000;
    const result = calculateFinalBpm(
      bpmHistoryRef.current,
      liveBpmRef.current,
      rawSignalRef.current,
      fpsRef.current,
    );

    if (result && elapsedSeconds >= MIN_SIGNAL_SECONDS) {
      setFinalBpm(result);
      setBpm(result);
      setReadings((prev) => [...prev, { bpm: result, timestamp: new Date() }].slice(-5));
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

    const w = 64; // sample small region for performance
    const h = 64;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;

    let redSum = 0;
    let greenSum = 0;
    let fingerPixels = 0;
    const totalPixels = w * h;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      redSum += r;
      greenSum += g;
      if (r > 65 && r > g * 1.12 && r > b * 1.12) {
        fingerPixels++;
      }
    }

    const avgRed = redSum / totalPixels;
    const avgGreen = greenSum / totalPixels;
    const redGreenRatio = avgRed / Math.max(avgGreen, 1);
    const fingerCoverage = fingerPixels / totalPixels;
    const now = performance.now();
    const elapsed = (now - startTimeRef.current) / 1000;

    const hasFinger =
      avgRed >= MIN_RED_THRESHOLD &&
      redGreenRatio >= MIN_RED_GREEN_RATIO &&
      fingerCoverage >= FINGER_COVERAGE_THRESHOLD;

    if (!hasFinger) {
      noFingerFramesRef.current += 1;

      if (elapsed > 2 && noFingerFramesRef.current >= NO_FINGER_FRAME_THRESHOLD && !wasNoFingerRef.current) {
        setStatus('no-finger');
        stableCountRef.current = 0;
        wasNoFingerRef.current = true;
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (wasNoFingerRef.current) {
      setStatus('detecting');
      wasNoFingerRef.current = false;
    }

    noFingerFramesRef.current = 0;

    // PPG-like signal: ratio is less sensitive to exposure changes than raw red channel.
    const signalValue = redGreenRatio;
    const signal = rawSignalRef.current;
    signal.push({ value: signalValue, time: elapsed });

    if (signal.length > SAMPLE_BUFFER_SIZE) {
      signal.splice(0, signal.length - SAMPLE_BUFFER_SIZE);
    }

    if (signal.length > 12) {
      const dt = signal[signal.length - 1].time - signal[signal.length - 13].time;
      if (dt > 0.1) {
        const estimatedFps = 12 / dt;
        fpsRef.current = Math.min(60, Math.max(15, estimatedFps));
      }
    }

    if (now - lastBpmUpdateRef.current > BPM_UPDATE_INTERVAL && signal.length > 70) {
      lastBpmUpdateRef.current = now;
      const analysis = analyzeHeartSignal(signal as HeartSignalSample[], fpsRef.current);

      const visStart = Math.max(0, analysis.filtered.length - Math.round(fpsRef.current * 5));
      const peakSet = new Set(analysis.peakIndices.filter((peak) => peak >= visStart));
      const visData: SignalPoint[] = [];

      for (let i = visStart; i < analysis.filtered.length; i++) {
        visData.push({
          time: parseFloat(signal[i].time.toFixed(2)),
          value: parseFloat(analysis.filtered[i].toFixed(2)),
          isPeak: peakSet.has(i),
        });
      }

      setSignalData(visData);

      if (analysis.bpm) {
        setBpm(analysis.bpm);
        bpmHistoryRef.current.push(analysis.bpm);
        if (bpmHistoryRef.current.length > 20) {
          bpmHistoryRef.current.splice(0, bpmHistoryRef.current.length - 20);
        }

        const recent = bpmHistoryRef.current.slice(-4);
        if (recent.length >= 3) {
          const spread = Math.max(...recent) - Math.min(...recent);
          if (spread <= STABLE_BPM_SPREAD && analysis.confidence >= 0.45) {
            stableCountRef.current = Math.min(stableCountRef.current + 1, MIN_STABLE_READINGS + 2);
          } else {
            stableCountRef.current = Math.max(0, stableCountRef.current - 1);
          }
        }

        setStatus(stableCountRef.current >= MIN_STABLE_READINGS ? 'stable' : 'detecting');
      } else if (elapsed >= 4) {
        setStatus('low-signal');
        stableCountRef.current = 0;
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  const startDetection = useCallback(async () => {
    setStatus('starting');
    setBpm(null);
    setSignalData([]);
    setMeasurementComplete(false);
    setFinalBpm(null);
    setProgress(0);
    rawSignalRef.current = [];
    stableCountRef.current = 0;
    bpmHistoryRef.current = [];
    noFingerFramesRef.current = 0;
    wasNoFingerRef.current = false;

    stopMediaStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 30 },
        },
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      try {
        const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        if (capabilities?.torch) {
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
      setStatus('detecting');
      animFrameRef.current = requestAnimationFrame(processFrame);

      const startTime = Date.now();
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / AUTO_STOP_DURATION) * 100, 100);
        setProgress(Math.round(pct));
      }, 500);

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
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stopMediaStream();
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [stopMediaStream]);

  const averageBpm = readings.length > 0
    ? Math.round(readings.reduce((sum, r) => sum + r.bpm, 0) / readings.length)
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
    startDetection,
    stopDetection,
    resetMeasurement,
    classifyBpm,
  };
}
