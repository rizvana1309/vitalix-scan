import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { Laptop, PersonStanding, Hammer } from 'lucide-react';
import { useUser, UserProfile } from '@/contexts/UserContext';

type ActivityLevel = 'low' | 'moderate' | 'high';

const activities = [
  {
    id: 'low' as ActivityLevel,
    icon: Laptop,
    title: 'Light Work',
    description: 'Office job, student, mostly sitting',
    color: 'bg-secondary text-secondary-foreground border-secondary',
    selectedColor: 'bg-primary/20 border-primary',
  },
  {
    id: 'moderate' as ActivityLevel,
    icon: PersonStanding,
    title: 'Moderate Work',
    description: 'Regular walking, some physical activity',
    color: 'bg-secondary text-secondary-foreground border-secondary',
    selectedColor: 'bg-primary/20 border-primary',
  },
  {
    id: 'high' as ActivityLevel,
    icon: Hammer,
    title: 'Heavy Work',
    description: 'Physical labor, sports, very active',
    color: 'bg-secondary text-secondary-foreground border-secondary',
    selectedColor: 'bg-primary/20 border-primary',
  },
];

export default function ActivityLevel() {
  const navigate = useNavigate();
  const { setUserProfile, setIsOnboarded } = useUser();
  const [selectedActivity, setSelectedActivity] = useState<ActivityLevel | null>(null);

  const handleFinish = () => {
    // Get stored data
    const basicData = JSON.parse(sessionStorage.getItem('onboarding_basic') || '{}');
    const goalData = JSON.parse(sessionStorage.getItem('onboarding_goal') || '{}');

    const profile: UserProfile = {
      name: basicData.name,
      age: parseInt(basicData.age),
      height: parseInt(basicData.height),
      weight: parseInt(basicData.weight),
      gender: basicData.gender,
      healthGoal: goalData.goal,
      activityLevel: selectedActivity!,
    };

    setUserProfile(profile);
    setIsOnboarded(true);
    
    // Clear session storage
    sessionStorage.removeItem('onboarding_basic');
    sessionStorage.removeItem('onboarding_goal');

    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto pt-8">
        <ProgressIndicator currentStep={3} totalSteps={3} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-bold text-foreground mb-2">What's your activity level?</h1>
          <p className="text-muted-foreground">This helps us calculate your daily needs</p>
        </motion.div>

        <div className="space-y-4">
          {activities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedActivity(activity.id)}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedActivity === activity.id ? activity.selectedColor : activity.color
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  selectedActivity === activity.id ? 'bg-primary/20' : 'bg-background'
                }`}>
                  <activity.icon className={`w-7 h-7 ${
                    selectedActivity === activity.id ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">{activity.title}</h3>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <Button
          onClick={handleFinish}
          disabled={!selectedActivity}
          size="lg"
          className="w-full h-14 text-lg rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg mt-8"
        >
          Finish Setup
        </Button>
      </div>
    </div>
  );
}
