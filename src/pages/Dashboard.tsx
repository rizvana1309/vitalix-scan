import { motion } from 'framer-motion';
import { 
  Heart, Footprints, Droplets, Flame, Activity, 
  TrendingUp, Scale, Sparkles 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { useUser } from '@/contexts/UserContext';
import { calculateBiologicalAge } from '@/lib/biologicalAge';

export default function Dashboard() {
  const { 
    userProfile, 
    healthData, 
    calculateBMI, 
    calculateDailyCalories, 
    calculateDailyWater 
  } = useUser();

  const bmi = calculateBMI();
  const dailyCalories = calculateDailyCalories() || 2000;
  const dailyWater = calculateDailyWater() || 2500;
  const bioAge = calculateBiologicalAge(userProfile, healthData, dailyWater);
  const bioReady = 'biologicalAge' in bioAge;
  
  const remainingCalories = dailyCalories - healthData.caloriesConsumed;
  const caloriesBurned = Math.round(healthData.stepsToday * 0.04);
  const waterProgress = Math.round((healthData.waterConsumed / dailyWater) * 100);
  const stepsProgress = Math.round((healthData.stepsToday / 10000) * 100);

  const getAISuggestion = () => {
    const suggestions = [];
    
    if (waterProgress < 50) {
      suggestions.push('💧 Drink more water - you\'re behind on hydration!');
    }
    if (stepsProgress < 50) {
      suggestions.push('🚶 Take a walk - you need more steps today!');
    }
    if (remainingCalories < 300) {
      suggestions.push('🥗 Be careful with your next meal - you\'re close to your calorie limit.');
    }
    if (healthData.heartRate && healthData.heartRate > 100) {
      suggestions.push('❤️ Your heart rate was elevated. Try some relaxation.');
    }
    
    if (suggestions.length === 0) {
      if (waterProgress >= 80 && stepsProgress >= 80) {
        return '🌟 Amazing! You\'re crushing your health goals today! Keep it up!';
      }
      return '✨ You\'re doing well today. Stay consistent with your healthy habits!';
    }
    
    return suggestions[0];
  };

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-md mx-auto pt-4">
        <PageHeader title="Health Dashboard" subtitle="Your complete health overview" />

        {/* AI Suggestion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/10 rounded-2xl p-5 mb-6 border border-primary/20"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">AI Health Insight</p>
              <p className="text-sm text-muted-foreground">{getAISuggestion()}</p>
            </div>
          </div>
        </motion.div>

        {/* BMI Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-5 border border-border/50 mb-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Scale className="w-5 h-5 text-primary" />
              </div>
              <span className="font-medium text-foreground">Body Mass Index</span>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-foreground">{bmi?.value || '-'}</span>
            <span className={`text-lg font-medium mb-1 ${
              bmi?.category === 'Normal' ? 'text-success' : 
              bmi?.category === 'Overweight' ? 'text-warning' : 'text-foreground'
            }`}>
              {bmi?.category}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{bmi?.insight}</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <StatCard
            icon={Flame}
            title="Calories"
            value={`${remainingCalories}`}
            subtitle="kcal remaining"
            iconBgColor="bg-warning/10"
            iconColor="text-warning"
            delay={0.2}
          />
          <StatCard
            icon={Activity}
            title="Consumed"
            value={`${healthData.caloriesConsumed}`}
            subtitle="kcal today"
            iconBgColor="bg-success/10"
            iconColor="text-success"
            delay={0.25}
          />
          <StatCard
            icon={Footprints}
            title="Steps"
            value={healthData.stepsToday.toLocaleString()}
            subtitle={`${stepsProgress}% of goal`}
            iconBgColor="bg-steps/10"
            iconColor="text-steps"
            delay={0.3}
          />
          <StatCard
            icon={Droplets}
            title="Water"
            value={`${healthData.waterConsumed}`}
            subtitle={`${waterProgress}% of goal`}
            iconBgColor="bg-water/10"
            iconColor="text-water"
            delay={0.35}
          />
        </div>

        {/* Heart Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl p-5 border border-border/50 mb-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-heart/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-heart" />
              </div>
              <div>
                <p className="font-medium text-foreground">Heart Rate</p>
                <p className="text-sm text-muted-foreground">
                  {healthData.lastHeartRateTime 
                    ? `Last measured ${new Date(healthData.lastHeartRateTime).toLocaleTimeString()}`
                    : 'Not measured yet'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold text-foreground">
                {healthData.heartRate || '-'}
              </span>
              <span className="text-muted-foreground ml-1">BPM</span>
            </div>
          </div>
        </motion.div>

        {/* Foods Scanned Today */}
        {healthData.foodsScanned.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-card rounded-2xl p-5 border border-border/50"
          >
            <h3 className="font-semibold text-foreground mb-4">Foods Scanned Today</h3>
            <div className="space-y-3">
              {healthData.foodsScanned.slice(-3).map((food, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="font-medium text-foreground">{food.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(food.time).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{food.calories} kcal</p>
                    <p className={`text-xs ${
                      food.decision === 'allow' ? 'text-success' :
                      food.decision === 'limit' ? 'text-warning' : 'text-destructive'
                    }`}>
                      {food.decision === 'allow' ? '✓ Approved' :
                       food.decision === 'limit' ? '⚠ Limited' : '✕ Avoided'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
