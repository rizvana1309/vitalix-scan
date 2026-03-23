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
const MAX_BPM = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length);
}

function trimmedAverage(values: number[]) {
  if (values.length === 0) return 0;
  if (values.length <= 2) return Math.round(mean(values));
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.max(1, Math.floor(sorted.length * 0.15));
  const trimmed = sorted.slice(trim, sorted.length - trim);
  return Math.round(mean(trimmed.length > 0 ? trimmed : sorted));
}

// ─── Moving average smoothing ───
export function movingAverage(data: number[], window: number): number[] {
  if (data.length === 0) return [];
  const half = Math.floor(window / 2);
  const result: number[] = new Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length, i + half + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j];
    result[i] = sum / (end - start);
  }
  return result;
}

// ─── RC-based bandpass filter (high-pass then low-pass) ───
export function bandpassFilter(data: number[], fps: number, lowHz: number, highHz: number): number[] {
  if (data.length < 2) return [...data];
  const safeFps = clamp(fps || 30, 15, 60);
  const dt = 1 / safeFps;

  // High-pass: remove DC / slow drift (cutoff = lowHz)
  const rcHigh = 1 / (2 * Math.PI * lowHz);
  const alphaHigh = rcHigh / (rcHigh + dt);
  const hp: number[] = [0];
  for (let i = 1; i < data.length; i++) {
    hp.push(alphaHigh * (hp[i - 1] + data[i] - data[i - 1]));
  }

  // Low-pass: remove high-freq noise (cutoff = highHz)
  const rcLow = 1 / (2 * Math.PI * highHz);
  const alphaLow = dt / (rcLow + dt);
  const lp: number[] = [hp[0]];
  for (let i = 1; i < hp.length; i++) {
    lp.push(lp[i - 1] + alphaLow * (hp[i] - lp[i - 1]));
  }
  return lp;
}

// ─── Spike removal: clip values beyond N std from mean ───
function removeSpikes(data: number[], nStd = 2.5): number[] {
  const avg = mean(data);
  const std = standardDeviation(data);
  if (std === 0) return [...data];
  const lo = avg - nStd * std;
  const hi = avg + nStd * std;
  return data.map(v => clamp(v, lo, hi));
}

// ─── Adaptive peak detection ───
export function detectPeaks(data: number[], minDistanceSamples: number): number[] {
  const peaks: number[] = [];
  if (data.length < 3) return peaks;

  const avg = mean(data);
  const std = standardDeviation(data);
  // Adaptive threshold: must be above average + fraction of std
  const threshold = avg + 0.3 * std;

  for (let i = 1; i < data.length - 1; i++) {
    if (
      data[i] > data[i - 1] &&
      data[i] > data[i + 1] &&
      data[i] > threshold
    ) {
      if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistanceSamples) {
        peaks.push(i);
      } else if (data[i] > data[peaks[peaks.length - 1]]) {
        // Replace previous peak if this one is taller (within min distance)
        peaks[peaks.length - 1] = i;
      }
    }
  }
  return peaks;
}

// ─── Full signal analysis pipeline ───
export function analyzeHeartSignal(samples: HeartSignalSample[], fps: number): AnalyzeResult {
  if (samples.length < 45) {
    return { bpm: null, filtered: [], peakIndices: [], confidence: 0 };
  }

  const values = samples.map(s => s.value);

  // 1. Remove spikes
  const cleaned = removeSpikes(values, 2.5);

  // 2. Smooth with moving average (window 5)
  const smoothed = movingAverage(cleaned, 5);

  // 3. Bandpass filter: 0.7 Hz – 4 Hz (42–240 BPM range)
  const filtered = bandpassFilter(smoothed, fps, 0.7, 4.0);

  // 4. Second smoothing pass for cleaner peaks
  const finalSignal = movingAverage(filtered, 3);

  // 5. Peak detection with min distance = 0.4s
  const safeFps = clamp(fps, 15, 60);
  const minDist = Math.max(3, Math.round(safeFps * 0.4));
  const peakIndices = detectPeaks(finalSignal, minDist);

  if (peakIndices.length < 2) {
    return { bpm: null, filtered: finalSignal, peakIndices, confidence: 0.05 };
  }

  // 6. Calculate intervals between peaks (in seconds)
  const intervals: number[] = [];
  for (let i = 1; i < peakIndices.length; i++) {
    const dt = samples[peakIndices[i]].time - samples[peakIndices[i - 1]].time;
    if (dt >= 0.3 && dt <= 1.5) intervals.push(dt);
  }

  if (intervals.length < 2) {
    return { bpm: null, filtered: finalSignal, peakIndices, confidence: 0.1 };
  }

  // 7. Remove outlier intervals (>2 std from mean)
  const avgInterval = mean(intervals);
  const stdInterval = standardDeviation(intervals);
  const inliers = stdInterval > 0
    ? intervals.filter(dt => Math.abs(dt - avgInterval) <= 2 * stdInterval)
    : intervals;
  const usable = inliers.length >= 2 ? inliers : intervals;

  const robustInterval = mean(usable);
  const bpm = Math.round(60 / robustInterval);

  if (bpm < MIN_BPM || bpm > MAX_BPM) {
    return { bpm: null, filtered: finalSignal, peakIndices, confidence: 0.1 };
  }

  // 8. Confidence score
  const stabilityScore = clamp(1 - (stdInterval / Math.max(robustInterval, 0.001)), 0, 1);
  const peakScore = clamp(peakIndices.length / 8, 0, 1);
  const intervalConsistency = usable.length / Math.max(intervals.length, 1);
  const confidence = Number(
    (0.45 * stabilityScore + 0.30 * peakScore + 0.25 * intervalConsistency).toFixed(2)
  );

  return { bpm, filtered: finalSignal, peakIndices, confidence };
}

// ─── Alternative: count-based BPM (peaks / time * 60) ───
export function countBasedBpm(samples: HeartSignalSample[], fps: number): { bpm: number | null; confidence: number } {
  if (samples.length < 60) return { bpm: null, confidence: 0 };

  const values = samples.map(s => s.value);
  const cleaned = removeSpikes(values);
  const smoothed = movingAverage(cleaned, 5);
  const filtered = bandpassFilter(smoothed, fps, 0.7, 4.0);
  const finalSignal = movingAverage(filtered, 3);

  const safeFps = clamp(fps, 15, 60);
  const minDist = Math.max(3, Math.round(safeFps * 0.4));
  const peaks = detectPeaks(finalSignal, minDist);

  if (peaks.length < 2) return { bpm: null, confidence: 0 };

  const firstPeakTime = samples[peaks[0]].time;
  const lastPeakTime = samples[peaks[peaks.length - 1]].time;
  const duration = lastPeakTime - firstPeakTime;

  if (duration < 2) return { bpm: null, confidence: 0 };

  const bpm = Math.round(((peaks.length - 1) / duration) * 60);
  if (bpm < MIN_BPM || bpm > MAX_BPM) return { bpm: null, confidence: 0 };

  const confidence = clamp(peaks.length / 10, 0, 1);
  return { bpm, confidence };
}

// ─── Final BPM: merge history, interval-based, count-based, and live reading ───
export function calculateFinalBpm(
  bpmHistory: number[],
  liveBpm: number | null,
  samples: HeartSignalSample[],
  fps: number,
): number | null {
  const cleanHistory = bpmHistory.filter(v => v >= MIN_BPM && v <= MAX_BPM);
  const historyBpm = cleanHistory.length >= 2 ? trimmedAverage(cleanHistory) : null;

  const analysis = analyzeHeartSignal(samples, fps);
  const signalBpm = analysis.confidence >= 0.35 ? analysis.bpm : null;

  const countResult = countBasedBpm(samples, fps);
  const countBpm = countResult.confidence >= 0.3 ? countResult.bpm : null;

  // Collect all available estimates
  const candidates: number[] = [];
  if (historyBpm) candidates.push(historyBpm);
  if (signalBpm) candidates.push(signalBpm);
  if (countBpm) candidates.push(countBpm);
  if (liveBpm && liveBpm >= MIN_BPM && liveBpm <= MAX_BPM) candidates.push(liveBpm);

  if (candidates.length === 0) return null;

  // Use trimmed average of all available estimates
  const result = trimmedAverage(candidates);
  if (result < MIN_BPM || result > MAX_BPM) return null;

  return result;
}
