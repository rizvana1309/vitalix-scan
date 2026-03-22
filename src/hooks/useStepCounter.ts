import { useState, useEffect, useRef, useCallback } from 'react';

interface StepCounterState {
  steps: number;
  speed: number;
  calories: number;
  distance: number;
  activityType: 'idle' | 'walking' | 'running';
  isTracking: boolean;
  hasAccelerometer: boolean;
  isSimulation: boolean;
  elapsedTime: number;
  stepsPerSecond: number;
  stepHistory: { time: number; steps: number }[];
  speedHistory: { time: number; speed: number }[];
  calorieProgress: number;
}

interface UserParams {
  height: number;
  weight: number;
  age: number;
  gender: 'male' | 'female';
}

// --- Signal processing constants ---
const SMOOTHING_WINDOW = 5;
const PEAK_BUFFER_SIZE = 64;
const MIN_STEP_INTERVAL_MS = 300; // humans can't step faster than ~3.3 steps/s
const MAX_STEP_INTERVAL_MS = 2000; // slower than 0.5 steps/s = not walking
const INACTIVITY_WINDOW_MS = 2500; // 2.5s of low variance = inactive
const INACTIVITY_VARIANCE_THRESHOLD = 0.15; // variance below this = no movement
const HIGH_PASS_ALPHA = 0.85;
const MIN_VALID_STEP_FREQ = 0.5; // steps/sec — below = noise
const GRAVITY = 9.81;

export function useStepCounter(userParams: UserParams | null) {
  const [state, setState] = useState<StepCounterState>({
    steps: 0, speed: 0, calories: 0, distance: 0,
    activityType: 'idle', isTracking: false, hasAccelerometer: false,
    isSimulation: false, elapsedTime: 0, stepsPerSecond: 0,
    stepHistory: [], speedHistory: [], calorieProgress: 0,
  });

  // Refs for signal processing pipeline
  const rawMagHistory = useRef<number[]>([]);
  const filteredHistory = useRef<number[]>([]); // after high-pass + smoothing
  const prevRawMag = useRef(GRAVITY);
  const prevFiltered = useRef(0);
  const lastStepTime = useRef(0);
  const stepsRef = useRef(0);
  const startTimeRef = useRef(0);
  const recentStepTimestamps = useRef<number[]>([]);
  const recentRawValues = useRef<number[]>([]); // for inactivity detection
  const isTrackingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const historyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const simPhaseRef = useRef(0);
  const isInactiveRef = useRef(false);

  const strideLength = userParams ? (userParams.height * 0.415) / 100 : 0.7;
  const weight = userParams?.weight ?? 70;
  const calorieGoal = 500;

  // ─── 1. High-pass filter: removes gravity component ───
  const highPassFilter = useCallback((rawMagnitude: number): number => {
    const filtered = HIGH_PASS_ALPHA * (prevFiltered.current + rawMagnitude - prevRawMag.current);
    prevRawMag.current = rawMagnitude;
    prevFiltered.current = filtered;
    return filtered;
  }, []);

  // ─── 2. Moving average smoothing ───
  const smooth = useCallback((value: number): number => {
    rawMagHistory.current.push(value);
    if (rawMagHistory.current.length > SMOOTHING_WINDOW) rawMagHistory.current.shift();
    return rawMagHistory.current.reduce((a, b) => a + b, 0) / rawMagHistory.current.length;
  }, []);

  // ─── 3. Inactivity detection ───
  const checkInactivity = useCallback((rawMagnitude: number): boolean => {
    recentRawValues.current.push(rawMagnitude);
    // Keep ~2.5s of data at 30fps ≈ 75 samples
    if (recentRawValues.current.length > 75) recentRawValues.current.shift();
    if (recentRawValues.current.length < 15) return false;

    const values = recentRawValues.current;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    return variance < INACTIVITY_VARIANCE_THRESHOLD;
  }, []);

  // ─── 4. Peak detection with cooldown + validation ───
  const processSample = useCallback((rawMagnitude: number, timestamp: number): boolean => {
    // Inactivity check on raw magnitude
    const inactive = checkInactivity(rawMagnitude);
    isInactiveRef.current = inactive;
    if (inactive) return false;

    // Step 1: High-pass filter to remove gravity
    const linearAcc = highPassFilter(rawMagnitude);

    // Step 2: Smooth the filtered signal
    const smoothed = smooth(linearAcc);

    // Step 3: Store for peak detection
    filteredHistory.current.push(smoothed);
    if (filteredHistory.current.length > PEAK_BUFFER_SIZE) filteredHistory.current.shift();

    // Need at least 3 samples for peak detection
    if (filteredHistory.current.length < 3) return false;

    const len = filteredHistory.current.length;
    const prev2 = filteredHistory.current[len - 3];
    const prev1 = filteredHistory.current[len - 2]; // candidate peak
    const curr = filteredHistory.current[len - 1];

    // Dynamic threshold: based on recent signal range
    const recentWindow = filteredHistory.current.slice(-20);
    const maxVal = Math.max(...recentWindow);
    const minVal = Math.min(...recentWindow);
    const range = maxVal - minVal;
    
    // Threshold must be meaningful — at least 0.3 to avoid counting noise
    const dynamicThreshold = Math.max(minVal + range * 0.55, 0.3);

    // Peak detection: prev1 is higher than both neighbors AND above threshold
    const isPeak = prev1 > prev2 && prev1 > curr && prev1 > dynamicThreshold;

    // Cooldown: enforce minimum time gap between steps
    const timeSinceLastStep = timestamp - lastStepTime.current;
    if (!isPeak) return false;
    if (timeSinceLastStep < MIN_STEP_INTERVAL_MS) return false;

    // Step frequency validation: reject if too slow (noise)
    // Check recent step rate over last 3 seconds
    const now = timestamp;
    const recentSteps = recentStepTimestamps.current.filter(t => now - t < 3000);
    // Allow first few steps without frequency check
    if (recentSteps.length >= 3) {
      const windowSec = (now - recentSteps[0]) / 1000;
      const freq = recentSteps.length / windowSec;
      if (freq < MIN_VALID_STEP_FREQ) return false;
    }

    lastStepTime.current = timestamp;
    return true;
  }, [highPassFilter, smooth, checkInactivity]);

  // ─── Activity metrics ───
  const calculateMetrics = useCallback((steps: number, elapsedSec: number) => {
    const distance = steps * strideLength / 1000;

    const now = Date.now();
    const recentWindow = 3000;
    recentStepTimestamps.current = recentStepTimestamps.current.filter(t => now - t < recentWindow);
    const sps = recentStepTimestamps.current.length / (recentWindow / 1000);

    let activityType: 'idle' | 'walking' | 'running' = 'idle';
    let met = 1;
    if (sps >= 2) {
      activityType = 'running';
      met = 7;
    } else if (sps >= MIN_VALID_STEP_FREQ) {
      activityType = 'walking';
      met = 3.5;
    }

    const speed = elapsedSec > 0 ? distance / (elapsedSec / 3600) : 0;
    const hours = elapsedSec / 3600;
    const metCalories = met * weight * hours;
    const fallbackCalories = steps * 0.04;
    const calories = Math.max(metCalories, fallbackCalories);

    return {
      distance: parseFloat(distance.toFixed(3)),
      speed: parseFloat(Math.min(speed, 20).toFixed(1)),
      calories: Math.round(calories),
      activityType,
      stepsPerSecond: parseFloat(sps.toFixed(1)),
      calorieProgress: Math.min((calories / calorieGoal) * 100, 100),
    };
  }, [strideLength, weight, calorieGoal]);

  // ─── Real accelerometer handler ───
  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    if (!isTrackingRef.current) return;
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const x = acc.x ?? 0;
    const y = acc.y ?? 0;
    const z = acc.z ?? 0;
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const now = Date.now();

    if (processSample(magnitude, now)) {
      stepsRef.current += 1;
      recentStepTimestamps.current.push(now);
    }
  }, [processSample]);

  // ─── Simulation: realistic walking accelerometer data ───
  const startSimulation = useCallback(() => {
    let simTime = 0;
    // Simulate ~1.8 steps/sec walking pattern
    simIntervalRef.current = setInterval(() => {
      if (!isTrackingRef.current) return;

      simPhaseRef.current += 0.12; // controls step frequency
      simTime += 33;

      // Walking produces a double-peak pattern per step cycle
      const stepSignal = Math.sin(simPhaseRef.current * Math.PI) * 2.2;
      const secondaryBounce = Math.sin(simPhaseRef.current * Math.PI * 2) * 0.6;
      const bodyMotion = Math.sin(simTime / 4000) * 0.3; // slow body sway
      const noise = (Math.random() - 0.5) * 0.4; // small sensor noise
      
      // Vary intensity to simulate speed changes
      const intensityMod = 1 + 0.2 * Math.sin(simTime / 8000);
      
      const magnitude = GRAVITY + (stepSignal + secondaryBounce + bodyMotion + noise) * intensityMod;
      const now = Date.now();

      if (processSample(magnitude, now)) {
        stepsRef.current += 1;
        recentStepTimestamps.current.push(now);
      }
    }, 33);
  }, [processSample]);

  // Check sensor availability
  useEffect(() => {
    setState(prev => ({ ...prev, hasAccelerometer: 'DeviceMotionEvent' in window }));
  }, []);

  // Timer for UI updates
  useEffect(() => {
    if (state.isTracking) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const metrics = calculateMetrics(stepsRef.current, elapsed);
        setState(prev => ({
          ...prev,
          steps: stepsRef.current,
          elapsedTime: elapsed,
          ...metrics,
        }));
      }, 500);

      historyIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const metrics = calculateMetrics(stepsRef.current, elapsed);
        setState(prev => ({
          ...prev,
          stepHistory: [...prev.stepHistory.slice(-60), { time: elapsed, steps: stepsRef.current }],
          speedHistory: [...prev.speedHistory.slice(-60), { time: elapsed, speed: metrics.speed }],
        }));
      }, 5000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (historyIntervalRef.current) clearInterval(historyIntervalRef.current);
    };
  }, [state.isTracking, calculateMetrics]);

  const resetBuffers = useCallback(() => {
    rawMagHistory.current = [];
    filteredHistory.current = [];
    recentRawValues.current = [];
    recentStepTimestamps.current = [];
    prevRawMag.current = GRAVITY;
    prevFiltered.current = 0;
    lastStepTime.current = 0;
    isInactiveRef.current = false;
  }, []);

  const start = useCallback(async () => {
    stepsRef.current = 0;
    resetBuffers();
    startTimeRef.current = Date.now();
    simPhaseRef.current = 0;
    isTrackingRef.current = true;

    let useSimulation = false;

    if ('DeviceMotionEvent' in window) {
      try {
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
          const permission = await (DeviceMotionEvent as any).requestPermission();
          if (permission === 'granted') {
            window.addEventListener('devicemotion', handleMotion);
          } else {
            useSimulation = true;
          }
        } else {
          window.addEventListener('devicemotion', handleMotion);
          await new Promise(resolve => setTimeout(resolve, 500));
          if (filteredHistory.current.length === 0) {
            useSimulation = true;
            window.removeEventListener('devicemotion', handleMotion);
          }
        }
      } catch {
        useSimulation = true;
      }
    } else {
      useSimulation = true;
    }

    if (useSimulation) startSimulation();

    setState(prev => ({
      ...prev,
      isTracking: true, isSimulation: useSimulation,
      steps: 0, speed: 0, calories: 0, distance: 0,
      activityType: 'idle', elapsedTime: 0, stepsPerSecond: 0,
      stepHistory: [], speedHistory: [], calorieProgress: 0,
    }));
  }, [handleMotion, startSimulation, resetBuffers]);

  const pause = useCallback(() => {
    isTrackingRef.current = false;
    window.removeEventListener('devicemotion', handleMotion);
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    setState(prev => ({ ...prev, isTracking: false }));
  }, [handleMotion]);

  const reset = useCallback(() => {
    pause();
    stepsRef.current = 0;
    resetBuffers();
    setState(prev => ({
      ...prev,
      steps: 0, speed: 0, calories: 0, distance: 0,
      activityType: 'idle', elapsedTime: 0, stepsPerSecond: 0,
      stepHistory: [], speedHistory: [], calorieProgress: 0,
    }));
  }, [pause, resetBuffers]);

  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (historyIntervalRef.current) clearInterval(historyIntervalRef.current);
    };
  }, [handleMotion]);

  return { ...state, start, pause, reset };
}
