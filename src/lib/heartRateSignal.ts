export interface HeartSignalSample {
  value: number;
  time: number;
}

interface AnalyzeResult {
  bpm: number | null;
  filtered: number[];
  peakIndices: number[];
  confidence: number;
}

const MIN_BPM = 40;
const MAX_BPM = 200;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(values: number[]) {
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length);
}

function trimmedAverage(values: number[]) {
  if (values.length <= 2) return Math.round(mean(values));

  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.max(1, Math.floor(sorted.length * 0.15));
  const trimmed = sorted.slice(trim, sorted.length - trim);
  return Math.round(mean(trimmed.length > 0 ? trimmed : sorted));
}

export function movingAverage(data: number[], window: number) {
  if (data.length === 0) return data;

  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(data.length, i + Math.ceil(window / 2));
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j];
    result.push(sum / Math.max(1, end - start));
  }

  return result;
}

export function bandpassFilter(data: number[], fps: number, lowHz: number, highHz: number) {
  if (data.length === 0) return data;

  const safeFps = clamp(fps || 30, 15, 60);
  const dt = 1 / safeFps;
  const rcLow = 1 / (2 * Math.PI * highHz);
  const rcHigh = 1 / (2 * Math.PI * lowHz);
  const alphaLow = dt / (rcLow + dt);
  const alphaHigh = rcHigh / (rcHigh + dt);

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

export function detectPeaks(data: number[], minDistance: number) {
  const peaks: number[] = [];
  if (data.length < 3) return peaks;

  const avg = mean(data);
  const std = standardDeviation(data);
  const threshold = avg + 0.35 * std;

  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > threshold) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      }
    }
  }

  return peaks;
}

export function analyzeHeartSignal(samples: HeartSignalSample[], fps: number): AnalyzeResult {
  if (samples.length < 60) {
    return { bpm: null, filtered: [], peakIndices: [], confidence: 0 };
  }

  const values = samples.map((sample) => sample.value);
  const smoothed = movingAverage(values, 5);
  const filtered = bandpassFilter(smoothed, fps, 0.8, 3.0);

  const minDist = Math.max(4, Math.round(clamp(fps, 15, 60) * 60 / 180));
  const peakIndices = detectPeaks(filtered, minDist);
  if (peakIndices.length < 3) {
    return { bpm: null, filtered, peakIndices, confidence: 0.1 };
  }

  const intervals: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    const dt = samples[peakIndices[i]].time - samples[peakIndices[i - 1]].time;
    if (dt >= 0.3 && dt <= 1.5) intervals.push(dt);
  }

  if (intervals.length < 2) {
    return { bpm: null, filtered, peakIndices, confidence: 0.2 };
  }

  const avgInterval = mean(intervals);
  const stdInterval = standardDeviation(intervals);
  const inliers = intervals.filter((interval) => Math.abs(interval - avgInterval) <= 2 * stdInterval || stdInterval === 0);
  const usableIntervals = inliers.length >= 2 ? inliers : intervals;

  const robustInterval = mean(usableIntervals);
  const bpm = Math.round(60 / robustInterval);
  if (bpm < MIN_BPM || bpm > MAX_BPM) {
    return { bpm: null, filtered, peakIndices, confidence: 0.15 };
  }

  const stabilityScore = clamp(1 - stdInterval / Math.max(robustInterval, 0.001), 0, 1);
  const peakScore = clamp(peakIndices.length / 9, 0, 1);
  const confidence = Number((0.65 * stabilityScore + 0.35 * peakScore).toFixed(2));

  return { bpm, filtered, peakIndices, confidence };
}

export function calculateFinalBpm(
  bpmHistory: number[],
  liveBpm: number | null,
  samples: HeartSignalSample[],
  fps: number,
) {
  const cleanedHistory = bpmHistory.filter((value) => value >= MIN_BPM && value <= MAX_BPM);
  const historyBpm = cleanedHistory.length > 0 ? trimmedAverage(cleanedHistory) : null;

  const analysis = analyzeHeartSignal(samples, fps);
  const signalBpm = analysis.confidence >= 0.45 ? analysis.bpm : null;

  let result: number | null = null;

  if (historyBpm && signalBpm) {
    result = Math.abs(historyBpm - signalBpm) <= 10
      ? Math.round((historyBpm + signalBpm) / 2)
      : historyBpm;
  } else {
    result = historyBpm ?? signalBpm ?? liveBpm;
  }

  if (!result) return null;
  if (result < MIN_BPM || result > MAX_BPM) return null;

  return result;
}