import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Footprints, Flame, Trophy, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { CircularProgress } from '@/components/CircularProgress';
import { useUser } from '@/contexts/UserContext';

export default function Steps() {
  const { healthData, setHealthData, userProfile } = useUser();
  const [isTracking, setIsTracking] = useState(false);
  
  const dailyGoal = 10000;
  const stepsToday = healthData.stepsToday;
  const caloriesBurned = Math.round(stepsToday * 0.04);
  const progress = Math.min((stepsToday / dailyGoal) * 100, 100);

  // Simulate step counting when tracking is on
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTracking) {
      interval = setInterval(() => {
        setHealthData(prev => ({
          ...prev,
          stepsToday: prev.stepsToday + Math.floor(Math.random() * 3) + 1,
        }));
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isTracking, setHealthData]);

  const getActivityStatus = () => {
    if (stepsToday < 3000) return { label: 'Low Activity', color: 'text-destructive' };
    if (stepsToday < 7000) return { label: 'Good Progress', color: 'text-warning' };
    if (stepsToday < 10000) return { label: 'Great Activity', color: 'text-success' };
    return { label: 'Excellent!', color: 'text-primary' };
  };

  const status = getActivityStatus();

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-md mx-auto pt-4">
        <PageHeader title="Step Counter" subtitle="Track your daily activity" />

        {/* Main Progress */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-border/50 p-8 text-center mb-6"
        >
          <CircularProgress
            value={stepsToday}
            max={dailyGoal}
            size={200}
            strokeWidth={16}
            color="hsl(var(--steps))"
          >
            <div>
              <Footprints className="w-8 h-8 text-steps mx-auto mb-2" />
              <div className="text-4xl font-bold text-foreground">
                {stepsToday.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                / {dailyGoal.toLocaleString()} steps
              </div>
            </div>
          </CircularProgress>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-steps/10 ${status.color}`}
          >
            <Trophy className="w-4 h-4" />
            <span className="font-semibold">{status.label}</span>
          </motion.div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-2xl p-5 border border-border/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-warning" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">{caloriesBurned}</div>
            <div className="text-sm text-muted-foreground">Calories Burned</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-2xl p-5 border border-border/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Footprints className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {((stepsToday * 0.0008).toFixed(2))}
            </div>
            <div className="text-sm text-muted-foreground">Distance (km)</div>
          </motion.div>
        </div>

        {/* Tracking Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            onClick={() => setIsTracking(!isTracking)}
            size="lg"
            className={`w-full h-14 text-lg rounded-2xl ${
              isTracking 
                ? 'bg-muted text-foreground hover:bg-muted/80' 
                : 'bg-steps hover:bg-steps/90 text-steps-foreground'
            }`}
          >
            {isTracking ? (
              <>
                <Pause className="w-5 h-5 mr-2" />
                Pause Tracking
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Start Tracking
              </>
            )}
          </Button>
          
          <p className="text-center text-sm text-muted-foreground mt-4">
            {isTracking 
              ? 'Steps are being tracked in real-time'
              : 'Start tracking to count your steps'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
