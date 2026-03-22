import { useState, useEffect, useRef, useCallback } from 'react';

interface StepCounterState {
  steps: number;
  speed: number; // km/h
  calories: number;
  distance: number; // km
  activityType: 'idle' | 'walking' | 'running';
  isTracking: boolean;
  hasAccelerometer: boolean;
  isSimulation: boolean;
  elapsedTime: number; // seconds
  stepsPerSecond: number;
  stepHistory: { time: number; steps: number }[];
  speedHistory: { time: number; speed: number }[];
  calorieProgress: number; // 0-100
}

interface UserParams {
  height: number; // cm
  weight: number; // kg
  age: number;
  gender: 'male' | 'female';
}

const BUFFER_SIZE = 50;
const MOVING_AVG_WINDOW = 5;
const MIN_STEP_INTERVAL = 250; // ms - minimum time between steps
const GRAVITY = 9.81;

// Dynamic threshold parameters
const THRESHOLD_WINDOW = 20;
const THRESHOLD_FACTOR = 0.6;

export function useStepCounter(userParams: UserParams | null) {
  const [state, setState] = useState<StepCounterState>({
    steps: 0,
    speed: 0,
    calories: 0,
    distance: 0,
    activityType: 'idle',
    isTracking: false,
    hasAccelerometer: false,
    isSimulation: false,
    elapsedTime: 0,
    stepsPerSecond: 0,
    stepHistory: [],
    speedHistory: [],
    calorieProgress: 0,
  });

  const magnitudeBuffer = useRef<number[]>([]);
  const smoothedBuffer = useRef<number[]>([]);
  const lastStepTime = useRef<number>(0);
  const stepsRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const recentStepTimestamps = useRef<number[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const historyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const simPhaseRef = useRef(0);
  const isTrackingRef = useRef(false);

  const strideLength = userParams
    ? (userParams.height * 0.415) / 100 // meters
    : 0.7; // default 70cm

  const weight = userParams?.weight ?? 70;
  const calorieGoal = 500;

  // Moving average filter
  const applyMovingAverage = useCallback((buffer: number[], value: number): number => {
    buffer.push(value);
    if (buffer.length > MOVING_AVG_WINDOW) buffer.shift();
    return buffer.reduce((a, b) => a + b, 0) / buffer.length;
  }, []);

  // Dynamic threshold calculation
  const getDynamicThreshold = useCallback((): number => {
    if (smoothedBuffer.current.length < THRESHOLD_WINDOW) return GRAVITY + 1.5;
    const recent = smoothedBuffer.current.slice(-THRESHOLD_WINDOW);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const range = max - min;
    return min + range * THRESHOLD_FACTOR;
  }, []);

  // Peak detection - detect when signal crosses threshold going up
  const detectStep = useCallback((magnitude: number, timestamp: number): boolean => {
    const smoothed = applyMovingAverage([...smoothedBuffer.current], magnitude);
    smoothedBuffer.current.push(smoothed);
    if (smoothedBuffer.current.length > BUFFER_SIZE) smoothedBuffer.current.shift();

    magnitudeBuffer.current.push(magnitude);
    if (magnitudeBuffer.current.length > BUFFER_SIZE) magnitudeBuffer.current.shift();

    if (magnitudeBuffer.current.length < 3) return false;

    const len = smoothedBuffer.current.length;
    const prev2 = smoothedBuffer.current[len - 3] ?? 0;
    const prev1 = smoothedBuffer.current[len - 2] ?? 0;
    const curr = smoothedBuffer.current[len - 1] ?? 0;

    const threshold = getDynamicThreshold();

    // Peak: prev1 > prev2 AND prev1 > curr AND prev1 > threshold
    const isPeak = prev1 > prev2 && prev1 > curr && prev1 > threshold;
    const timeSinceLastStep = timestamp - lastStepTime.current;

    if (isPeak && timeSinceLastStep > MIN_STEP_INTERVAL) {
      lastStepTime.current = timestamp;
      return true;
    }
    return false;
  }, [applyMovingAverage, getDynamicThreshold]);

  // Calculate activity metrics
  const calculateMetrics = useCallback((steps: number, elapsedSec: number) => {
    const distance = steps * strideLength / 1000; // km

    // Steps per second for activity classification
    const now = Date.now();
    const recentWindow = 3000; // 3 second window
    recentStepTimestamps.current = recentStepTimestamps.current.filter(
      t => now - t < recentWindow
    );
    const sps = recentStepTimestamps.current.length / (recentWindow / 1000);

    let activityType: 'idle' | 'walking' | 'running' = 'idle';
    let met = 1;
    if (sps >= 2) {
      activityType = 'running';
      met = 7;
    } else if (sps > 0.3) {
      activityType = 'walking';
      met = 3.5;
    }

    // Speed: sensor-based
    const speed = elapsedSec > 0
      ? (distance / (elapsedSec / 3600)) // km/h
      : 0;

    // Calories: MET-based
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

  // Handle real accelerometer data
  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    if (!isTrackingRef.current) return;
    const acc = event.accelerationIncludingGravity;
    if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

    const x = acc.x ?? 0;
    const y = acc.y ?? 0;
    const z = acc.z ?? 0;
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const now = Date.now();

    if (detectStep(magnitude, now)) {
      stepsRef.current += 1;
      recentStepTimestamps.current.push(now);
    }
  }, [detectStep]);

  // Simulation: generate realistic walking accelerometer data
  const startSimulation = useCallback(() => {
    let simTime = 0;
    simIntervalRef.current = setInterval(() => {
      if (!isTrackingRef.current) return;

      // Simulate walking pattern: sinusoidal with noise
      simPhaseRef.current += 0.15; // ~2Hz step frequency at 30fps
      const walkingSignal = Math.sin(simPhaseRef.current * Math.PI) * 2.5;
      const noise = (Math.random() - 0.5) * 0.8;
      const bodyMotion = Math.sin(simPhaseRef.current * 0.3) * 0.3;

      // Vary intensity occasionally (simulate speed changes)
      simTime += 33;
      const intensityMod = 1 + 0.3 * Math.sin(simTime / 5000);

      const magnitude = GRAVITY + (walkingSignal + noise + bodyMotion) * intensityMod;
      const now = Date.now();

      if (detectStep(magnitude, now)) {
        stepsRef.current += 1;
        recentStepTimestamps.current.push(now);
      }
    }, 33); // ~30fps
  }, [detectStep]);

  // Check accelerometer availability
  useEffect(() => {
    const hasMotion = 'DeviceMotionEvent' in window;
    setState(prev => ({ ...prev, hasAccelerometer: hasMotion }));
  }, []);

  // Timer for elapsed time and metric updates
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

      // History recording every 5 seconds
      historyIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const metrics = calculateMetrics(stepsRef.current, elapsed);

        setState(prev => ({
          ...prev,
          stepHistory: [
            ...prev.stepHistory.slice(-60),
            { time: elapsed, steps: stepsRef.current },
          ],
          speedHistory: [
            ...prev.speedHistory.slice(-60),
            { time: elapsed, speed: metrics.speed },
          ],
        }));
      }, 5000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (historyIntervalRef.current) clearInterval(historyIntervalRef.current);
    };
  }, [state.isTracking, calculateMetrics]);

  const start = useCallback(async () => {
    stepsRef.current = 0;
    magnitudeBuffer.current = [];
    smoothedBuffer.current = [];
    recentStepTimestamps.current = [];
    lastStepTime.current = 0;
    startTimeRef.current = Date.now();
    simPhaseRef.current = 0;
    isTrackingRef.current = true;

    let useSimulation = false;

    // Try real accelerometer first
    if ('DeviceMotionEvent' in window) {
      try {
        // iOS 13+ requires permission
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
          const permission = await (DeviceMotionEvent as any).requestPermission();
          if (permission === 'granted') {
            window.addEventListener('devicemotion', handleMotion);
          } else {
            useSimulation = true;
          }
        } else {
          window.addEventListener('devicemotion', handleMotion);
          // Check if we actually get data after a short delay
          await new Promise(resolve => setTimeout(resolve, 500));
          if (magnitudeBuffer.current.length === 0) {
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

    if (useSimulation) {
      startSimulation();
    }

    setState(prev => ({
      ...prev,
      isTracking: true,
      isSimulation: useSimulation,
      steps: 0,
      speed: 0,
      calories: 0,
      distance: 0,
      activityType: 'idle',
      elapsedTime: 0,
      stepsPerSecond: 0,
      stepHistory: [],
      speedHistory: [],
      calorieProgress: 0,
    }));
  }, [handleMotion, startSimulation]);

  const pause = useCallback(() => {
    isTrackingRef.current = false;
    window.removeEventListener('devicemotion', handleMotion);
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    setState(prev => ({ ...prev, isTracking: false }));
  }, [handleMotion]);

  const reset = useCallback(() => {
    pause();
    stepsRef.current = 0;
    magnitudeBuffer.current = [];
    smoothedBuffer.current = [];
    recentStepTimestamps.current = [];
    setState(prev => ({
      ...prev,
      steps: 0,
      speed: 0,
      calories: 0,
      distance: 0,
      activityType: 'idle',
      elapsedTime: 0,
      stepsPerSecond: 0,
      stepHistory: [],
      speedHistory: [],
      calorieProgress: 0,
    }));
  }, [pause]);

  // Cleanup
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
