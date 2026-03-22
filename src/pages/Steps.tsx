import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Footprints, Flame, Trophy, Play, Pause, RotateCcw,
  Gauge, MapPin, Activity, Smartphone, Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { CircularProgress } from '@/components/CircularProgress';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/contexts/UserContext';
import { useStepCounter } from '@/hooks/useStepCounter';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart,
} from 'recharts';

export default function Steps() {
  const { healthData, setHealthData, userProfile } = useUser();

  const userParams = userProfile
    ? { height: userProfile.height, weight: userProfile.weight, age: userProfile.age, gender: userProfile.gender }
    : null;

  const counter = useStepCounter(userParams);
  const dailyGoal = 10000;
  const displaySteps = counter.isTracking || counter.steps > 0 ? counter.steps : healthData.stepsToday;

  // Sync steps to context
  useEffect(() => {
    if (counter.steps > 0) {
      setHealthData(prev => ({ ...prev, stepsToday: counter.steps }));
    }
  }, [counter.steps, setHealthData]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getActivityStatus = () => {
    if (counter.activityType === 'running') return { label: 'Running', color: 'text-destructive', bg: 'bg-destructive/10' };
    if (counter.activityType === 'walking') return { label: 'Walking', color: 'text-success', bg: 'bg-success/10' };
    if (counter.isTracking) return { label: 'Idle', color: 'text-muted-foreground', bg: 'bg-muted' };
    if (displaySteps >= 10000) return { label: 'Goal Reached!', color: 'text-primary', bg: 'bg-primary/10' };
    if (displaySteps >= 5000) return { label: 'Great Progress', color: 'text-success', bg: 'bg-success/10' };
    return { label: 'Ready', color: 'text-muted-foreground', bg: 'bg-muted' };
  };

  const status = getActivityStatus();

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-md mx-auto pt-4 space-y-4">
        <PageHeader title="Step Counter" subtitle="Real-time activity tracking" />

        {/* Sensor badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center"
        >
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            counter.isSimulation
              ? 'bg-warning/10 text-warning'
              : 'bg-success/10 text-success'
          }`}>
            {counter.isSimulation ? (
              <><Wifi className="w-3 h-3" /> Simulation Mode</>
            ) : (
              <><Smartphone className="w-3 h-3" /> Accelerometer Active</>
            )}
          </div>
        </motion.div>

        {/* Main Progress Circle */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-border/50 p-6 text-center"
        >
          <CircularProgress
            value={displaySteps}
            max={dailyGoal}
            size={180}
            strokeWidth={14}
            color="hsl(var(--steps))"
          >
            <div>
              <Footprints className="w-7 h-7 text-steps mx-auto mb-1" />
              <div className="text-3xl font-bold text-foreground">
                {displaySteps.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                / {dailyGoal.toLocaleString()} steps
              </div>
            </div>
          </CircularProgress>

          <div className="flex items-center justify-center gap-4 mt-4">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${status.bg} ${status.color}`}>
              <Activity className="w-3.5 h-3.5" />
              <span className="text-sm font-semibold">{status.label}</span>
            </div>
            {counter.isTracking && (
              <span className="text-sm font-mono text-muted-foreground">
                {formatTime(counter.elapsedTime)}
              </span>
            )}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            icon={Gauge}
            label="Speed"
            value={`${counter.speed}`}
            unit="km/h"
            iconBg="bg-accent/10"
            iconColor="text-accent"
            delay={0.1}
          />
          <StatTile
            icon={Flame}
            label="Calories"
            value={`${counter.calories}`}
            unit="kcal"
            iconBg="bg-warning/10"
            iconColor="text-warning"
            delay={0.15}
          />
          <StatTile
            icon={MapPin}
            label="Distance"
            value={`${counter.distance}`}
            unit="km"
            iconBg="bg-primary/10"
            iconColor="text-primary"
            delay={0.2}
          />
          <StatTile
            icon={Footprints}
            label="Pace"
            value={`${counter.stepsPerSecond}`}
            unit="steps/s"
            iconBg="bg-steps/10"
            iconColor="text-steps"
            delay={0.25}
          />
        </div>

        {/* Calorie Progress */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border/50 p-4"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-foreground">Calorie Burn Progress</span>
            <span className="text-xs text-muted-foreground">{counter.calories} / 500 kcal</span>
          </div>
          <Progress value={counter.calorieProgress} className="h-3" />
        </motion.div>

        {/* Charts */}
        <AnimatePresence>
          {counter.stepHistory.length > 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              {/* Steps Over Time */}
              <div className="bg-card rounded-2xl border border-border/50 p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Steps Over Time</h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={counter.stepHistory}>
                      <defs>
                        <linearGradient id="stepsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--steps))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--steps))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(v) => `${Math.floor(v / 60)}m`}
                      />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="steps"
                        stroke="hsl(var(--steps))"
                        fill="url(#stepsGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Speed Trend */}
              <div className="bg-card rounded-2xl border border-border/50 p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Speed Trend</h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={counter.speedHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(v) => `${Math.floor(v / 60)}m`}
                      />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="speed"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-3"
        >
          {!counter.isTracking ? (
            <Button
              onClick={counter.start}
              size="lg"
              className="w-full h-14 text-lg rounded-2xl bg-steps hover:bg-steps/90 text-steps-foreground"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Tracking
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={counter.pause}
                size="lg"
                className="h-14 text-base rounded-2xl bg-muted text-foreground hover:bg-muted/80"
              >
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </Button>
              <Button
                onClick={counter.reset}
                size="lg"
                variant="outline"
                className="h-14 text-base rounded-2xl"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Reset
              </Button>
            </div>
          )}

          {counter.steps > 0 && !counter.isTracking && (
            <Button
              onClick={counter.reset}
              size="lg"
              variant="outline"
              className="w-full h-12 rounded-2xl"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}

          <p className="text-center text-xs text-muted-foreground">
            {counter.isTracking
              ? counter.isSimulation
                ? 'Simulating realistic walking patterns'
                : 'Using device accelerometer for step detection'
              : 'Tap start to begin real-time step tracking'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// Small stat tile component
function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  iconBg,
  iconColor,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit: string;
  iconBg: string;
  iconColor: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card rounded-2xl p-4 border border-border/50"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </motion.div>
  );
}
