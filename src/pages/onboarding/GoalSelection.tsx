import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { TrendingDown, TrendingUp, Heart } from 'lucide-react';

type Goal = 'weight-loss' | 'weight-gain' | 'healthy';

const goals = [
  {
    id: 'weight-loss' as Goal,
    icon: TrendingDown,
    title: 'Weight Loss',
    description: 'Lose weight and get fit',
    color: 'bg-success/10 text-success border-success/30',
    selectedColor: 'bg-success/20 border-success',
  },
  {
    id: 'weight-gain' as Goal,
    icon: TrendingUp,
    title: 'Weight Gain',
    description: 'Build muscle and gain healthy weight',
    color: 'bg-accent/10 text-accent border-accent/30',
    selectedColor: 'bg-accent/20 border-accent',
  },
  {
    id: 'healthy' as Goal,
    icon: Heart,
    title: 'Healthy Lifestyle',
    description: 'Maintain health and stay balanced',
    color: 'bg-primary/10 text-primary border-primary/30',
    selectedColor: 'bg-primary/20 border-primary',
  },
];

export default function GoalSelection() {
  const navigate = useNavigate();
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  const handleNext = () => {
    sessionStorage.setItem('onboarding_goal', JSON.stringify({ goal: selectedGoal }));
    navigate('/onboarding/3');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto pt-8">
        <ProgressIndicator currentStep={2} totalSteps={3} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-bold text-foreground mb-2">What's your health goal?</h1>
          <p className="text-muted-foreground">Choose the goal that best fits your needs</p>
        </motion.div>

        <div className="space-y-4">
          {goals.map((goal, index) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedGoal(goal.id)}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedGoal === goal.id ? goal.selectedColor : goal.color
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  selectedGoal === goal.id ? 'bg-white/80' : 'bg-white/50'
                }`}>
                  <goal.icon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">{goal.title}</h3>
                  <p className="text-sm text-muted-foreground">{goal.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <Button
          onClick={handleNext}
          disabled={!selectedGoal}
          size="lg"
          className="w-full h-14 text-lg rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg mt-8"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
