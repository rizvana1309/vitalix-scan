import { useState, useRef, useCallback, useEffect } from 'react';

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

const SAMPLE_BUFFER_SIZE = 300; // ~10 seconds at 30fps
const BPM_UPDATE_INTERVAL = 2000; // update BPM every 2s
const AUTO_STOP_DURATION = 45000; // auto-stop after 45 seconds for better accuracy
const MIN_STABLE_READINGS = 3; // need 3 stable readings before auto-stop
const MIN_RED_THRESHOLD = 50; // minimum red channel avg to detect finger
const FINGER_COVERAGE_THRESHOLD = 0.6; // 60% of pixels must be reddish
const SMOOTHING_WINDOW = 5;
const BANDPASS_LOW = 0.8; // Hz (48 BPM)
const BANDPASS_HIGH = 3.0; // Hz (180 BPM)
const MIN_PEAKS_FOR_BPM = 3;

function movingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(data.length, i + Math.ceil(window / 2));
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j];
    result.push(sum / (end - start));
  }
  return result;
}

function bandpassFilter(data: number[], fps: number, lowHz: number, highHz: number): number[] {
  // Simple frequency domain bandpass using DFT on short windows
  // For real-time, we use a cascaded single-pole IIR approximation
  const dt = 1 / fps;
  const rcLow = 1 / (2 * Math.PI * highHz);
  const rcHigh = 1 / (2 * Math.PI * lowHz);
  const alphaLow = dt / (rcLow + dt);
  const alphaHigh = rcHigh / (rcHigh + dt);

  // High-pass then low-pass
  const highPassed: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    highPassed.push(alphaHigh * (highPassed[i - 1] + data[i] - data[i - 1]));
  }

  const lowPassed: number[] = [highPassed[0]];
  for (let i = 1; i < highPassed.length; i++) {
    lowPassed.push(lowPassed[i - 1] + alphaLow * (highPassed[i] - lowPassed[i - 1]));
  }

  return lowPassed;
}

function detectPeaks(data: number[], minDistance: number): number[] {
  const peaks: number[] = [];
  if (data.length < 3) return peaks;

  // Adaptive threshold: mean + 0.3 * std
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const std = Math.sqrt(data.reduce((a, b) => a + (b - mean) ** 2, 0) / data.length);
  const threshold = mean + 0.3 * std;

  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > threshold) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      }
    }
  }
  return peaks;
}

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
      // Finger on camera produces high red, low green/blue
      if (r > 80 && r > g * 1.2 && r > b * 1.2) {
        fingerPixels++;
      }
    }

    const avgRed = redSum / totalPixels;
    const avgGreen = greenSum / totalPixels;
    const fingerCoverage = fingerPixels / totalPixels;
    const now = performance.now();
    const elapsed = (now - startTimeRef.current) / 1000;

    // Check if finger is on camera
    if (avgRed < MIN_RED_THRESHOLD || fingerCoverage < FINGER_COVERAGE_THRESHOLD) {
      if (elapsed > 2) {
        setStatus('no-finger');
        stableCountRef.current = 0;
      }
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Use red channel average as PPG signal (inverted for some cameras)
    const signalValue = avgRed;
    const signal = rawSignalRef.current;
    signal.push({ value: signalValue, time: elapsed });

    // Keep buffer size manageable
    if (signal.length > SAMPLE_BUFFER_SIZE) {
      signal.splice(0, signal.length - SAMPLE_BUFFER_SIZE);
    }

    // Calculate FPS
    if (signal.length > 10) {
      const dt = signal[signal.length - 1].time - signal[signal.length - 11].time;
      fpsRef.current = 10 / dt;
    }

    // Update BPM periodically
    if (now - lastBpmUpdateRef.current > BPM_UPDATE_INTERVAL && signal.length > 60) {
      lastBpmUpdateRef.current = now;

      const values = signal.map(s => s.value);
      const smoothed = movingAverage(values, SMOOTHING_WINDOW);
      const filtered = bandpassFilter(smoothed, fpsRef.current, BANDPASS_LOW, BANDPASS_HIGH);

      // Min peak distance: fps * 60/maxBPM
      const minDist = Math.round(fpsRef.current * 60 / 180);
      const peakIndices = detectPeaks(filtered, minDist);

      // Build signal visualization data (last ~5 seconds)
      const visStart = Math.max(0, filtered.length - Math.round(fpsRef.current * 5));
      const peakSet = new Set(peakIndices.filter(p => p >= visStart));
      const visData: SignalPoint[] = [];
      for (let i = visStart; i < filtered.length; i++) {
        visData.push({
          time: parseFloat((signal[i].time).toFixed(2)),
          value: parseFloat(filtered[i].toFixed(2)),
          isPeak: peakSet.has(i),
        });
      }
      setSignalData(visData);

      if (peakIndices.length >= MIN_PEAKS_FOR_BPM) {
        // Calculate BPM from peak intervals
        const intervals: number[] = [];
        for (let i = 1; i < peakIndices.length; i++) {
          const dt = signal[peakIndices[i]].time - signal[peakIndices[i - 1]].time;
          if (dt > 0) intervals.push(dt);
        }

        if (intervals.length >= 2) {
          // Remove outliers (> 2 std from mean)
          const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const stdInterval = Math.sqrt(intervals.reduce((a, b) => a + (b - meanInterval) ** 2, 0) / intervals.length);
          const filtered = intervals.filter(i => Math.abs(i - meanInterval) < 2 * stdInterval);

          if (filtered.length >= 2) {
            const avgInterval = filtered.reduce((a, b) => a + b, 0) / filtered.length;
            const calculatedBpm = Math.round(60 / avgInterval);

            if (calculatedBpm >= 40 && calculatedBpm <= 200) {
              setBpm(calculatedBpm);
              bpmHistoryRef.current.push(calculatedBpm);
              stableCountRef.current++;
              setStatus(stableCountRef.current >= 3 ? 'stable' : 'detecting');
            } else {
              setStatus('low-signal');
              stableCountRef.current = 0;
            }
          } else {
            setStatus('low-signal');
          }
        }
      } else {
        if (elapsed > 3) setStatus('detecting');
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  const finalizeMeasurement = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Calculate final BPM from history
    const history = bpmHistoryRef.current;
    let result: number | null = null;

    if (history.length >= 2) {
      // Remove outliers and average
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const std = Math.sqrt(history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length);
      const valid = history.filter(v => Math.abs(v - mean) < 2 * std);
      result = valid.length > 0
        ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
        : Math.round(mean);
    } else if (history.length === 1) {
      // Even a single reading is better than nothing
      result = history[0];
    } else if (bpm) {
      // Fallback: use whatever the last live BPM was
      result = bpm;
    }

    if (result && result >= 40 && result <= 200) {
      setFinalBpm(result);
      setBpm(result);

      setReadings(prev => {
        const updated = [...prev, { bpm: result!, timestamp: new Date() }];
        return updated.slice(-5);
      });
      setMeasurementComplete(true);
    } else {
      // No valid result — let user know
      setFinalBpm(null);
      setMeasurementComplete(true);
    }

    setProgress(100);
    setStatus('idle');
    setFlashEnabled(false);
  }, [bpm]);

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

      // Try enabling torch
      try {
        const capabilities = track.getCapabilities() as any;
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

      // Progress timer
      const startTime = Date.now();
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / AUTO_STOP_DURATION) * 100, 100);
        setProgress(Math.round(pct));
      }, 500);

      // Auto-stop after duration
      autoStopTimerRef.current = setTimeout(() => {
        finalizeMeasurement();
      }, AUTO_STOP_DURATION);

    } catch (err) {
      console.error('Camera access failed:', err);
      setStatus('error');
    }
  }, [processFrame, finalizeMeasurement]);

  const stopDetection = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    finalizeMeasurement();
  }, [finalizeMeasurement]);

  const resetMeasurement = useCallback(() => {
    setMeasurementComplete(false);
    setFinalBpm(null);
    setProgress(0);
    setBpm(null);
    setSignalData([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

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
