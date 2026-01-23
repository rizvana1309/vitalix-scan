import { motion } from 'framer-motion';
import { Heart, Activity, Droplets, Utensils } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Welcome() {
  const navigate = useNavigate();

  const features = [
    { icon: Utensils, label: 'Food Analysis' },
    { icon: Heart, label: 'Heart Rate' },
    { icon: Activity, label: 'Step Tracker' },
    { icon: Droplets, label: 'Hydration' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg"
        >
          <Heart className="w-12 h-12 text-primary-foreground" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-foreground mb-3"
        >
          Smart Health Assistant
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground mb-12"
        >
          AI-powered health monitoring for a better lifestyle
        </motion.p>

        {/* Feature Icons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center gap-4 mb-12"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">{feature.label}</span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <Button
            onClick={() => navigate('/onboarding/1')}
            size="lg"
            className="w-full h-14 text-lg rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
          >
            Get Started
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
