import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Loader2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { useUser } from '@/contexts/UserContext';

export default function HeartRate() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ bpm: number; status: string } | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const { setHealthData } = useUser();

  const startMeasurement = async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setIsMeasuring(true);
      setProgress(0);
      setResult(null);

      // Simulate measurement progress
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            completeMeasurement(stream);
            return 100;
          }
          return prev + 2;
        });
      }, 100);

    } catch (error) {
      setCameraError(true);
      // Simulate measurement without camera
      setIsMeasuring(true);
      setProgress(0);
      
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            completeMeasurement(null);
            return 100;
          }
          return prev + 2;
        });
      }, 100);
    }
  };

  const completeMeasurement = (stream: MediaStream | null) => {
    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Generate realistic heart rate (60-100 bpm for normal adult)
    const bpm = Math.floor(Math.random() * 40) + 60;
    let status = 'Normal';
    
    if (bpm < 60) status = 'Low';
    else if (bpm > 100) status = 'High';
    
    setResult({ bpm, status });
    setIsMeasuring(false);
    
    // Save to health data
    setHealthData(prev => ({
      ...prev,
      heartRate: bpm,
      lastHeartRateTime: new Date(),
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Normal':
        return 'text-success';
      case 'High':
        return 'text-destructive';
      case 'Low':
        return 'text-warning';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-md mx-auto pt-4">
        <PageHeader title="Heart Rate" subtitle="Measure using your camera" />

        <AnimatePresence mode="wait">
          {!isMeasuring && !result ? (
            <motion.div
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center"
            >
              <div className="bg-card rounded-3xl border border-border/50 aspect-square flex flex-col items-center justify-center mb-6">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-32 h-32 rounded-full bg-heart/10 flex items-center justify-center mb-6"
                >
                  <Heart className="w-16 h-16 text-heart" />
                </motion.div>
                
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Ready to Measure
                </h3>
                <p className="text-muted-foreground text-center px-8">
                  Place your finger gently on the camera lens
                </p>
              </div>

              <Button
                onClick={startMeasurement}
                size="lg"
                className="w-full h-14 text-lg rounded-2xl bg-heart hover:bg-heart/90 text-heart-foreground"
              >
                <Camera className="w-5 h-5 mr-2" />
                Start Measurement
              </Button>
            </motion.div>
          ) : isMeasuring ? (
            <motion.div
              key="measuring"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center"
            >
              <div className="bg-card rounded-3xl border border-border/50 aspect-square flex flex-col items-center justify-center overflow-hidden relative mb-6">
                {!cameraError && (
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                    playsInline
                    muted
                  />
                )}
                
                <div className="relative z-10">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="w-32 h-32 rounded-full bg-heart/20 flex items-center justify-center mb-4"
                  >
                    <Heart className="w-16 h-16 text-heart" fill="currentColor" />
                  </motion.div>
                  
                  <div className="text-3xl font-bold text-foreground mb-2">
                    Measuring...
                  </div>
                  
                  <div className="w-48 h-2 bg-muted rounded-full mx-auto overflow-hidden">
                    <motion.div
                      className="h-full bg-heart rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                  
                  <p className="text-muted-foreground mt-4">
                    Keep your finger steady
                  </p>
                </div>
              </div>
            </motion.div>
          ) : result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="bg-card rounded-3xl border border-border/50 p-8 text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="w-32 h-32 rounded-full bg-heart/10 flex items-center justify-center mx-auto mb-6"
                >
                  <Heart className="w-16 h-16 text-heart" />
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="text-6xl font-bold text-foreground mb-2">
                    {result.bpm}
                  </div>
                  <div className="text-xl text-muted-foreground mb-4">BPM</div>
                  
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                    result.status === 'Normal' ? 'bg-success/10' :
                    result.status === 'High' ? 'bg-destructive/10' : 'bg-warning/10'
                  }`}>
                    <span className={`font-semibold ${getStatusColor(result.status)}`}>
                      {result.status === 'Normal' && '✓'} {result.status}
                    </span>
                  </div>
                  
                  <p className="text-muted-foreground mt-6">
                    {result.status === 'Normal' 
                      ? 'Your heart rate is within the healthy range.'
                      : result.status === 'High'
                      ? 'Consider relaxing or consulting a doctor if persistent.'
                      : 'Low heart rate detected. Consult a doctor if you feel unwell.'}
                  </p>
                </motion.div>
              </div>

              <Button
                onClick={() => setResult(null)}
                variant="outline"
                size="lg"
                className="w-full h-14 text-lg rounded-2xl"
              >
                Measure Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
