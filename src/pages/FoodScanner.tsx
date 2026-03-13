import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, CheckCircle, AlertTriangle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { useUser } from '@/contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-food`;

export default function FoodScanner() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<FoodResult | null>(null);
  const { userProfile, healthData, setHealthData, calculateDailyCalories } = useUser();
  const navigate = useNavigate();

  const dailyCalories = calculateDailyCalories() || 2000;
  const remainingCalories = dailyCalories - healthData.caloriesConsumed;

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setSelectedImage(base64);
        analyzeFood(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeFood = async (imageBase64: string) => {
    setIsAnalyzing(true);
    setResult(null);

    try {
      const resp = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          imageBase64,
          userProfile,
          remainingCalories,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data: FoodResult = await resp.json();
      setResult(data);
    } catch (e: any) {
      console.error('Food analysis error:', e);
      toast.error(e.message || 'Failed to analyze food. Please try again.');
      setSelectedImage(null);
    } finally {
      setIsAnalyzing(false);
    }
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
      toast.success(`${result.name} added to your food log!`);
      setSelectedImage(null);
      setResult(null);
    }
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'allow': return <CheckCircle className="w-6 h-6 text-success" />;
      case 'limit': return <AlertTriangle className="w-6 h-6 text-warning" />;
      case 'avoid': return <XCircle className="w-6 h-6 text-destructive" />;
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'allow': return 'bg-success/10 border-success/30 text-success';
      case 'limit': return 'bg-warning/10 border-warning/30 text-warning';
      case 'avoid': return 'bg-destructive/10 border-destructive/30 text-destructive';
    }
  };

  const getDecisionText = (decision: string) => {
    switch (decision) {
      case 'allow': return '✅ You may take this food';
      case 'limit': return '⚠️ Take in limited quantity';
      case 'avoid': return '❌ You should avoid this';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-md mx-auto pt-4">
        <PageHeader title="Scan Food" subtitle="Analyze your meals with AI" />

        {/* Remaining Calories */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Remaining Today</span>
            <span className="text-2xl font-bold text-primary">{remainingCalories} kcal</span>
          </div>
        </motion.div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleImageUpload} className="hidden" />

        <AnimatePresence mode="wait">
          {!selectedImage ? (
            <motion.div key="scanner" initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div onClick={() => fileInputRef.current?.click()}
                className="bg-card rounded-3xl border-2 border-dashed border-border aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Camera className="w-10 h-10 text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">Tap to Scan Food</p>
                <p className="text-sm text-muted-foreground">Take a photo or upload image</p>
              </div>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="lg"
                className="w-full h-14 rounded-2xl mt-4">
                <Upload className="w-5 h-5 mr-2" /> Upload from Gallery
              </Button>
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div className="rounded-2xl overflow-hidden mb-4">
                <img src={selectedImage} alt="Food" className="w-full aspect-square object-cover" />
              </div>

              {isAnalyzing ? (
                <div className="bg-card rounded-2xl p-8 text-center border border-border/50">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
                  <p className="text-lg font-medium text-foreground">Analyzing with AI...</p>
                  <p className="text-sm text-muted-foreground">Detecting food and nutrition</p>
                </div>
              ) : result && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className={`rounded-2xl p-4 border-2 mb-4 ${getDecisionColor(result.decision)}`}>
                    <div className="flex items-center gap-3">
                      {getDecisionIcon(result.decision)}
                      <span className="font-semibold text-lg">{getDecisionText(result.decision)}</span>
                    </div>
                  </div>

                  <div className="bg-card rounded-2xl p-5 border border-border/50 mb-4">
                    <h3 className="text-xl font-bold text-foreground mb-4">{result.name}</h3>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      {[
                        { val: result.calories, label: 'kcal', color: 'text-primary' },
                        { val: `${result.protein}g`, label: 'Protein', color: 'text-foreground' },
                        { val: `${result.carbs}g`, label: 'Carbs', color: 'text-foreground' },
                        { val: `${result.fat}g`, label: 'Fat', color: 'text-foreground' },
                      ].map(({ val, label, color }) => (
                        <div key={label} className="text-center">
                          <p className={`text-2xl font-bold ${color}`}>{val}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{result.reason}</p>
                    {result.alternative && (
                      <p className="text-sm text-primary">💡 {result.alternative}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => { setSelectedImage(null); setResult(null); }}
                      className="flex-1 h-12 rounded-xl">
                      Scan Again
                    </Button>
                    <Button onClick={addToLog} className="flex-1 h-12 rounded-xl bg-primary">
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
