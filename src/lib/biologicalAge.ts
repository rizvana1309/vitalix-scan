import type { UserProfile, HealthData } from '@/contexts/UserContext';

export type ScoreLevel = 'poor' | 'average' | 'good';

export interface FactorScore {
  label: string;
  value: string;
  score: number;
  level: ScoreLevel;
  reason: string;
}

export interface BiologicalAgeResult {
  actualAge: number;
  biologicalAge: number;
  totalScore: number;
  status: 'better' | 'same' | 'worse';
  statusLabel: string;
  factors: FactorScore[];
  missing: string[];
}

const levelFromScore = (s: number): ScoreLevel =>
  s > 0 ? 'good' : s < 0 ? 'poor' : 'average';

export function calculateBiologicalAge(
  profile: UserProfile | null,
  data: HealthData,
  dailyWaterGoalMl?: number | null
): BiologicalAgeResult | { missing: string[] } {
  const missing: string[] = [];
  if (!profile) {
    return { missing: ['Complete your profile'] };
  }
  if (!profile.age) missing.push('Age');
  if (!profile.height || !profile.weight) missing.push('Height & Weight');

  const heartRate = data.heartRate;
  const steps = data.stepsToday;
  const water = data.waterConsumed;
  const foods = data.foodsScanned;

  if (!heartRate) missing.push('Resting Heart Rate');
  if (steps === undefined || steps === null) missing.push('Daily Steps');

  if (missing.length > 0) return { missing };

  const factors: FactorScore[] = [];

  // BMI
  const heightM = profile.height / 100;
  const bmi = profile.weight / (heightM * heightM);
  let bmiScore = 0;
  let bmiReason = '';
  if (bmi < 18.5 || bmi > 30) {
    bmiScore = -2;
    bmiReason = bmi < 18.5
      ? 'Underweight BMI is increasing your biological age'
      : 'High BMI is increasing your biological age';
  } else if (bmi >= 18.5 && bmi <= 24.9) {
    bmiScore = 2;
    bmiReason = 'Healthy BMI is improving your biological age';
  } else {
    bmiScore = 0;
    bmiReason = 'BMI is in the average range';
  }
  factors.push({
    label: 'BMI',
    value: bmi.toFixed(1),
    score: bmiScore,
    level: levelFromScore(bmiScore),
    reason: bmiReason,
  });

  // Activity (steps)
  let actScore = 0;
  let actReason = '';
  if (steps < 4000) {
    actScore = -2;
    actReason = 'Low daily activity is increasing your biological age';
  } else if (steps <= 8000) {
    actScore = 0;
    actReason = 'Average activity level — try to walk more';
  } else {
    actScore = 2;
    actReason = 'High activity level is improving your biological age';
  }
  factors.push({
    label: 'Activity',
    value: `${steps.toLocaleString()} steps`,
    score: actScore,
    level: levelFromScore(actScore),
    reason: actReason,
  });

  // Heart rate
  let hrScore = 0;
  let hrReason = '';
  if (heartRate! > 90) {
    hrScore = -2;
    hrReason = 'Elevated heart rate is increasing your biological age';
  } else if (heartRate! >= 70) {
    hrScore = 0;
    hrReason = 'Heart rate is in the average range';
  } else {
    hrScore = 2;
    hrReason = 'Low resting heart rate is improving your biological age';
  }
  factors.push({
    label: 'Resting Heart Rate',
    value: `${heartRate} BPM`,
    score: hrScore,
    level: levelFromScore(hrScore),
    reason: hrReason,
  });

  // Diet (based on scanned food decisions)
  let dietScore = 0;
  let dietReason = 'No food data scanned yet';
  let dietValue = 'No data';
  if (foods && foods.length > 0) {
    const allow = foods.filter((f) => f.decision === 'allow').length;
    const limit = foods.filter((f) => f.decision === 'limit').length;
    const avoid = foods.filter((f) => f.decision === 'avoid').length;
    const total = foods.length;
    const healthyRatio = allow / total;
    const junkRatio = avoid / total;

    if (junkRatio >= 0.5) {
      dietScore = -2;
      dietReason = 'Frequent junk food is increasing your biological age';
      dietValue = 'Poor';
    } else if (healthyRatio >= 0.6) {
      dietScore = 2;
      dietReason = 'Healthy eating is improving your biological age';
      dietValue = 'Healthy';
    } else {
      dietScore = 0;
      dietReason = 'Balanced diet — keep adding healthy choices';
      dietValue = 'Balanced';
    }
    void limit;
  }
  factors.push({
    label: 'Diet',
    value: dietValue,
    score: dietScore,
    level: levelFromScore(dietScore),
    reason: dietReason,
  });

  // Hydration
  const waterGoal = dailyWaterGoalMl || 2000;
  let hydScore = 0;
  let hydReason = '';
  if (water < 2000) {
    hydScore = -1;
    hydReason = 'Low hydration is slightly increasing your biological age';
  } else {
    hydScore = 1;
    hydReason = 'Good hydration is helping your biological age';
  }
  factors.push({
    label: 'Hydration',
    value: `${water} / ${waterGoal} ml`,
    score: hydScore,
    level: levelFromScore(hydScore),
    reason: hydReason,
  });

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const biologicalAge = Math.max(1, profile.age - totalScore);

  let status: 'better' | 'same' | 'worse' = 'same';
  let statusLabel = 'Matches your age';
  if (biologicalAge < profile.age) {
    status = 'better';
    statusLabel = 'Healthier than your age';
  } else if (biologicalAge > profile.age) {
    status = 'worse';
    statusLabel = 'Needs improvement';
  }

  return {
    actualAge: profile.age,
    biologicalAge,
    totalScore,
    status,
    statusLabel,
    factors,
    missing: [],
  };
}
