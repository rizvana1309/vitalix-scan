import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ProgressIndicator } from '@/components/ProgressIndicator';

interface FormData {
  name: string;
  age: string;
  height: string;
  weight: string;
  gender: 'male' | 'female';
}

export default function BasicDetails() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    age: '',
    height: '',
    weight: '',
    gender: 'male',
  });

  const isValid = formData.name && formData.age && formData.height && formData.weight;

  const handleNext = () => {
    sessionStorage.setItem('onboarding_basic', JSON.stringify(formData));
    navigate('/onboarding/2');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto pt-8">
        <ProgressIndicator currentStep={1} totalSteps={3} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl font-bold text-foreground mb-2">Let's get to know you</h1>
          <p className="text-muted-foreground">Enter your basic details to personalize your experience</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <div>
            <Label htmlFor="name" className="text-foreground">Your Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-2 h-12 rounded-xl bg-card border-border"
            />
          </div>

          <div>
            <Label htmlFor="age" className="text-foreground">Age</Label>
            <Input
              id="age"
              type="number"
              placeholder="Enter your age"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="mt-2 h-12 rounded-xl bg-card border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="height" className="text-foreground">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                placeholder="170"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                className="mt-2 h-12 rounded-xl bg-card border-border"
              />
            </div>
            <div>
              <Label htmlFor="weight" className="text-foreground">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="70"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="mt-2 h-12 rounded-xl bg-card border-border"
              />
            </div>
          </div>

          <div>
            <Label className="text-foreground mb-3 block">Gender</Label>
            <RadioGroup
              value={formData.gender}
              onValueChange={(value) => setFormData({ ...formData, gender: value as 'male' | 'female' })}
              className="flex gap-4"
            >
              <motion.div
                whileTap={{ scale: 0.98 }}
                className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.gender === 'male'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
                onClick={() => setFormData({ ...formData, gender: 'male' })}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="cursor-pointer text-foreground">Male</Label>
                </div>
              </motion.div>
              <motion.div
                whileTap={{ scale: 0.98 }}
                className={`flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.gender === 'female'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
                onClick={() => setFormData({ ...formData, gender: 'female' })}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female" className="cursor-pointer text-foreground">Female</Label>
                </div>
              </motion.div>
            </RadioGroup>
          </div>

          <Button
            onClick={handleNext}
            disabled={!isValid}
            size="lg"
            className="w-full h-14 text-lg rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg mt-8"
          >
            Next
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
