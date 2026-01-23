import { motion } from 'framer-motion';
import { Camera, Heart, Footprints, Droplets, LayoutDashboard } from 'lucide-react';
import { FeatureCard } from '@/components/FeatureCard';
import { useUser } from '@/contexts/UserContext';

const features = [
  {
    icon: Camera,
    title: 'Scan Food',
    subtitle: 'Analyze your meals with AI',
    to: '/food-scanner',
    iconBgColor: 'bg-success/10',
    iconColor: 'text-success',
  },
  {
    icon: Heart,
    title: 'Heart Rate',
    subtitle: 'Measure using your camera',
    to: '/heart-rate',
    iconBgColor: 'bg-heart/10',
    iconColor: 'text-heart',
  },
  {
    icon: Footprints,
    title: 'Step Counter',
    subtitle: 'Track your daily activity',
    to: '/steps',
    iconBgColor: 'bg-steps/10',
    iconColor: 'text-steps',
  },
  {
    icon: Droplets,
    title: 'Water Reminder',
    subtitle: 'Stay hydrated throughout the day',
    to: '/water',
    iconBgColor: 'bg-water/10',
    iconColor: 'text-water',
  },
  {
    icon: LayoutDashboard,
    title: 'Health Summary',
    subtitle: 'View your complete health dashboard',
    to: '/dashboard',
    iconBgColor: 'bg-primary/10',
    iconColor: 'text-primary',
  },
];

export default function Home() {
  const { userProfile, calculateBMI, calculateDailyCalories } = useUser();
  const bmi = calculateBMI();
  const dailyCalories = calculateDailyCalories();

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-md mx-auto pt-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-foreground">
            👋 Hi, {userProfile?.name || 'User'}
          </h1>
          <p className="text-muted-foreground">Today's Health Overview</p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-5 shadow-sm border border-border/50 mb-6"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">BMI</p>
              <p className="text-2xl font-bold text-foreground">{bmi?.value || '-'}</p>
              <p className="text-xs text-primary">{bmi?.category || 'Not calculated'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Daily Goal</p>
              <p className="text-2xl font-bold text-foreground">{dailyCalories || '-'}</p>
              <p className="text-xs text-primary">kcal</p>
            </div>
          </div>
        </motion.div>

        {/* Features */}
        <div className="space-y-3">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.to}
              {...feature}
              delay={0.2 + index * 0.1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
