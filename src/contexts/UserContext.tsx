import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface UserProfile {
  age: number;
  height: number;
  weight: number;
  gender: 'male' | 'female';
  activityLevel: 'low' | 'moderate' | 'high';
  healthGoal: 'weight-loss' | 'weight-gain' | 'healthy';
  name?: string;
}

export interface HealthData {
  stepsToday: number;
  caloriesConsumed: number;
  waterConsumed: number;
  heartRate: number | null;
  lastHeartRateTime: Date | null;
  foodsScanned: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    decision: 'allow' | 'limit' | 'avoid';
    time: Date;
  }>;
}

interface UserContextType {
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;
  healthData: HealthData;
  setHealthData: React.Dispatch<React.SetStateAction<HealthData>>;
  isOnboarded: boolean;
  setIsOnboarded: (value: boolean) => void;
  calculateBMI: () => { value: number; category: string; insight: string } | null;
  calculateDailyCalories: () => number | null;
  calculateDailyWater: () => number | null;
}

const defaultHealthData: HealthData = {
  stepsToday: 0,
  caloriesConsumed: 0,
  waterConsumed: 0,
  heartRate: null,
  lastHeartRateTime: null,
  foodsScanned: [],
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [healthData, setHealthData] = useState<HealthData>(defaultHealthData);
  const [isOnboarded, setIsOnboarded] = useState(false);

  const calculateBMI = () => {
    if (!userProfile) return null;
    const heightInMeters = userProfile.height / 100;
    const bmi = userProfile.weight / (heightInMeters * heightInMeters);
    
    let category = '';
    let insight = '';
    
    if (bmi < 18.5) {
      category = 'Underweight';
      insight = 'Consider a balanced diet to gain healthy weight.';
    } else if (bmi < 25) {
      category = 'Normal';
      insight = 'Great! Maintain your healthy lifestyle.';
    } else if (bmi < 30) {
      category = 'Overweight';
      insight = 'Focus on balanced nutrition and regular exercise.';
    } else {
      category = 'Obese';
      insight = 'Consult a healthcare provider for personalized advice.';
    }
    
    return { value: parseFloat(bmi.toFixed(1)), category, insight };
  };

  const calculateDailyCalories = () => {
    if (!userProfile) return null;
    
    // BMR calculation (Mifflin-St Jeor)
    let bmr: number;
    if (userProfile.gender === 'male') {
      bmr = 10 * userProfile.weight + 6.25 * userProfile.height - 5 * userProfile.age + 5;
    } else {
      bmr = 10 * userProfile.weight + 6.25 * userProfile.height - 5 * userProfile.age - 161;
    }
    
    // Activity multiplier
    const activityMultipliers = {
      low: 1.2,
      moderate: 1.55,
      high: 1.9,
    };
    
    let tdee = bmr * activityMultipliers[userProfile.activityLevel];
    
    // Goal adjustment
    if (userProfile.healthGoal === 'weight-loss') {
      tdee -= 500;
    } else if (userProfile.healthGoal === 'weight-gain') {
      tdee += 500;
    }
    
    return Math.round(tdee);
  };

  const calculateDailyWater = () => {
    if (!userProfile) return null;
    // Base: 30-35ml per kg, adjusted for activity
    const baseWater = userProfile.weight * 33;
    const activityBonus = {
      low: 0,
      moderate: 500,
      high: 1000,
    };
    return Math.round(baseWater + activityBonus[userProfile.activityLevel]);
  };

  return (
    <UserContext.Provider
      value={{
        userProfile,
        setUserProfile,
        healthData,
        setHealthData,
        isOnboarded,
        setIsOnboarded,
        calculateBMI,
        calculateDailyCalories,
        calculateDailyWater,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
