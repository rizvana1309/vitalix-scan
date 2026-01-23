import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { useUser } from '@/contexts/UserContext';

interface FoodResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  classification: 'healthy' | 'moderate' | 'unhealthy';
  decision: 'allow' | 'limit' | 'avoid';
  reason: string;
  alternative?: string;
}

export default function FoodScanner() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<FoodResult | null>(null);
  const { healthData, setHealthData, calculateDailyCalories } = useUser();

  const dailyCalories = calculateDailyCalories() || 2000;
  const remainingCalories = dailyCalories - healthData.caloriesConsumed;

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        analyzeFood();
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeFood = () => {
    setIsAnalyzing(true);
    setResult(null);
    
    // Simulate AI analysis (would integrate with Gemini Vision in production)
    setTimeout(() => {
      const mockFoods: FoodResult[] = [
        {
          name: 'Grilled Chicken Salad',
          calories: 350,
          protein: 35,
          carbs: 15,
          fat: 18,
          classification: 'healthy',
          decision: 'allow',
          reason: 'High protein, low carbs. Perfect for your health goal!',
        },
        {
          name: 'Cheese Pizza Slice',
          calories: 285,
          protein: 12,
          carbs: 36,
          fat: 10,
          classification: 'moderate',
          decision: 'limit',
          reason: 'Moderate calories but high in carbs. Limit to 1-2 slices.',
          alternative: 'Try a whole wheat crust with vegetables instead.',
        },
        {
          name: 'Chocolate Cake',
          calories: 450,
          protein: 5,
          carbs: 55,
          fat: 25,
          classification: 'unhealthy',
          decision: 'avoid',
          reason: 'High sugar and calories. May exceed your daily goal.',
          alternative: 'Try fresh fruits or dark chocolate instead.',
        },
      ];
      
      const randomResult = mockFoods[Math.floor(Math.random() * mockFoods.length)];
      
      // Adjust decision based on remaining calories
      if (randomResult.calories > remainingCalories) {
        randomResult.decision = 'avoid';
        randomResult.reason = `This exceeds your remaining ${remainingCalories} kcal for today.`;
      }
      
      setResult(randomResult);
      setIsAnalyzing(false);
    }, 2000);
  };

  const addToLog = () => {
    if (result) {
      setHealthData(prev => ({
        ...prev,
        caloriesConsumed: prev.caloriesConsumed + result.calories,
        foodsScanned: [
          ...prev.foodsScanned,
          {
            name: result.name,
            calories: result.calories,
            protein: result.protein,
            carbs: result.carbs,
            fat: result.fat,
            decision: result.decision,
            time: new Date(),
          },
        ],
      }));
      setSelectedImage(null);
      setResult(null);
    }
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'allow':
        return <CheckCircle className="w-6 h-6 text-success" />;
      case 'limit':
        return <AlertTriangle className="w-6 h-6 text-warning" />;
      case 'avoid':
        return <XCircle className="w-6 h-6 text-destructive" />;
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'allow':
        return 'bg-success/10 border-success/30 text-success';
      case 'limit':
        return 'bg-warning/10 border-warning/30 text-warning';
      case 'avoid':
        return 'bg-destructive/10 border-destructive/30 text-destructive';
    }
  };

  const getDecisionText = (decision: string) => {
    switch (decision) {
      case 'allow':
        return '✅ You may take this food';
      case 'limit':
        return '⚠️ Take in limited quantity';
      case 'avoid':
        return '❌ You should avoid this';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-md mx-auto pt-4">
        <PageHeader title="Scan Food" subtitle="Analyze your meals with AI" />

        {/* Remaining Calories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 mb-6"
        >
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Remaining Today</span>
            <span className="text-2xl font-bold text-primary">{remainingCalories} kcal</span>
          </div>
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageUpload}
          className="hidden"
        />

        <AnimatePresence mode="wait">
          {!selectedImage ? (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {/* Camera Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="bg-card rounded-3xl border-2 border-dashed border-border aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
              >
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Camera className="w-10 h-10 text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">Tap to Scan Food</p>
                <p className="text-sm text-muted-foreground">Take a photo or upload image</p>
              </div>

              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="lg"
                className="w-full h-14 rounded-2xl mt-4"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload from Gallery
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {/* Image Preview */}
              <div className="rounded-2xl overflow-hidden mb-4">
                <img
                  src={selectedImage}
                  alt="Food"
                  className="w-full aspect-square object-cover"
                />
              </div>

              {isAnalyzing ? (
                <div className="bg-card rounded-2xl p-8 text-center border border-border/50">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                  <p className="text-lg font-medium text-foreground">Analyzing with AI...</p>
                  <p className="text-sm text-muted-foreground">Detecting food and nutrition</p>
                </div>
              ) : result && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {/* Decision Banner */}
                  <div className={`rounded-2xl p-4 border-2 mb-4 ${getDecisionColor(result.decision)}`}>
                    <div className="flex items-center gap-3">
                      {getDecisionIcon(result.decision)}
                      <span className="font-semibold text-lg">{getDecisionText(result.decision)}</span>
                    </div>
                  </div>

                  {/* Food Details */}
                  <div className="bg-card rounded-2xl p-5 border border-border/50 mb-4">
                    <h3 className="text-xl font-bold text-foreground mb-4">{result.name}</h3>
                    
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">{result.calories}</p>
                        <p className="text-xs text-muted-foreground">kcal</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{result.protein}g</p>
                        <p className="text-xs text-muted-foreground">Protein</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{result.carbs}g</p>
                        <p className="text-xs text-muted-foreground">Carbs</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{result.fat}g</p>
                        <p className="text-xs text-muted-foreground">Fat</p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">{result.reason}</p>
                    {result.alternative && (
                      <p className="text-sm text-primary">💡 {result.alternative}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedImage(null);
                        setResult(null);
                      }}
                      className="flex-1 h-12 rounded-xl"
                    >
                      Scan Again
                    </Button>
                    <Button
                      onClick={addToLog}
                      className="flex-1 h-12 rounded-xl bg-primary"
                    >
                      Add to Log
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
