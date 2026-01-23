import { useState } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { useUser } from '@/contexts/UserContext';

export default function Water() {
  const { healthData, setHealthData, calculateDailyWater } = useUser();
  const [glassSize, setGlassSize] = useState(250);
  
  const dailyGoal = calculateDailyWater() || 2500;
  const consumed = healthData.waterConsumed;
  const remaining = Math.max(dailyGoal - consumed, 0);
  const progress = Math.min((consumed / dailyGoal) * 100, 100);
  
  // Calculate glasses remaining
  const glassesRemaining = Math.ceil(remaining / glassSize);

  const addWater = (amount: number) => {
    setHealthData(prev => ({
      ...prev,
      waterConsumed: prev.waterConsumed + amount,
    }));
  };

  const getProgressColor = () => {
    if (progress < 30) return 'bg-destructive';
    if (progress < 60) return 'bg-warning';
    return 'bg-water';
  };

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-md mx-auto pt-4">
        <PageHeader title="Water Intake" subtitle="Stay hydrated throughout the day" />

        {/* Main Progress */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-border/50 p-6 mb-6 relative overflow-hidden"
        >
          {/* Water Fill Animation */}
          <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-b-3xl">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="bg-water/20 w-full"
              style={{ minHeight: '0%' }}
            />
          </div>

          <div className="relative z-10 text-center py-8">
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-20 h-20 rounded-full bg-water/10 flex items-center justify-center mx-auto mb-4"
            >
              <Droplets className="w-10 h-10 text-water" />
            </motion.div>

            <div className="text-5xl font-bold text-foreground mb-1">
              {consumed}
              <span className="text-xl text-muted-foreground ml-1">ml</span>
            </div>
            
            <div className="text-muted-foreground mb-4">
              of {dailyGoal} ml daily goal
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1 }}
                className={`h-full rounded-full ${getProgressColor()}`}
              />
            </div>

            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>{Math.round(progress)}% complete</span>
              <span>{remaining} ml remaining</span>
            </div>
          </div>
        </motion.div>

        {/* Glass Size Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border/50 p-5 mb-6"
        >
          <label className="text-sm text-muted-foreground mb-2 block">
            Glass size (ml)
          </label>
          <div className="flex gap-2">
            {[150, 200, 250, 300, 500].map(size => (
              <button
                key={size}
                onClick={() => setGlassSize(size)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                  glassSize === size 
                    ? 'bg-water text-water-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Add Water Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            onClick={() => addWater(glassSize)}
            size="lg"
            className="w-full h-14 text-lg rounded-2xl bg-water hover:bg-water/90 text-water-foreground"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add {glassSize} ml
          </Button>
        </motion.div>

        {/* Reminder Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 bg-secondary/50 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-water" />
            <div>
              <p className="font-medium text-foreground">
                {glassesRemaining > 0 
                  ? `${glassesRemaining} glasses remaining today`
                  : '🎉 You reached your daily goal!'}
              </p>
              <p className="text-sm text-muted-foreground">
                {glassesRemaining > 0 
                  ? 'Keep drinking water to stay healthy'
                  : 'Great job staying hydrated!'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
