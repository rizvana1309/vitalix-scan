import { motion } from 'framer-motion';
import { Sparkles, TrendingDown, TrendingUp, Minus, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { useUser } from '@/contexts/UserContext';
import { calculateBiologicalAge } from '@/lib/biologicalAge';
import { Button } from '@/components/ui/button';

export default function BiologicalAge() {
  const navigate = useNavigate();
  const { userProfile, healthData, calculateDailyWater } = useUser();
  const result = calculateBiologicalAge(userProfile, healthData, calculateDailyWater());

  const isMissing = !('biologicalAge' in result);

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-md mx-auto pt-4">
        <PageHeader title="Biological Age" subtitle="Your body age based on lifestyle data" />

        {isMissing ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl p-6 border border-border/50 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-warning" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">
              Complete your profile and health data
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              We need the following to estimate your biological age:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 mb-6">
              {result.missing.map((m) => (
                <li key={m}>• {m}</li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/heart-rate')} variant="outline">
                Measure Heart Rate
              </Button>
              <Button onClick={() => navigate('/steps')} variant="outline">
                Track Steps
              </Button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Main Result Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl p-6 border border-border/50 mb-4"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Actual Age</p>
                  <p className="text-3xl font-bold text-foreground">{result.actualAge}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Biological Age</p>
                  <p className="text-3xl font-bold text-primary">{result.biologicalAge}</p>
                </div>
              </div>

              <div
                className={`flex items-center justify-center gap-2 py-3 rounded-xl ${
                  result.status === 'better'
                    ? 'bg-success/10 text-success'
                    : result.status === 'worse'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {result.status === 'better' ? (
                  <TrendingDown className="w-5 h-5" />
                ) : result.status === 'worse' ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <Minus className="w-5 h-5" />
                )}
                <span className="font-semibold">{result.statusLabel}</span>
              </div>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                Total lifestyle score:{' '}
                <span
                  className={`font-bold ${
                    result.totalScore > 0
                      ? 'text-success'
                      : result.totalScore < 0
                      ? 'text-destructive'
                      : 'text-foreground'
                  }`}
                >
                  {result.totalScore > 0 ? '+' : ''}
                  {result.totalScore}
                </span>
              </div>
            </motion.div>

            {/* Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl p-5 border border-border/50 mb-4"
            >
              <h3 className="font-semibold text-foreground mb-4">Score Breakdown</h3>
              <div className="space-y-4">
                {result.factors.map((f) => (
                  <div key={f.label} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="font-medium text-foreground">{f.label}</p>
                        <p className="text-xs text-muted-foreground">{f.value}</p>
                      </div>
                      <span
                        className={`text-sm font-bold px-2 py-1 rounded-md ${
                          f.level === 'good'
                            ? 'bg-success/10 text-success'
                            : f.level === 'poor'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {f.score > 0 ? '+' : ''}
                        {f.score}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.reason}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Disclaimer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground text-center"
            >
              ⚠️ This is an estimated biological age based on lifestyle data and not a medical
              diagnosis.
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
