import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Camera, Zap, ZapOff, Activity, Clock, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { HeartRateWaveform } from '@/components/HeartRateWaveform';
import { Progress } from '@/components/ui/progress';
import { useHeartRateDetection } from '@/hooks/useHeartRateDetection';
import { useUser } from '@/contexts/UserContext';
import { useEffect } from 'react';

const STATUS_MESSAGES: Record<string, { text: string; sub: string }> = {
  idle: { text: 'Ready to Measure', sub: 'Place your finger gently on the camera lens' },
  starting: { text: 'Starting Camera...', sub: 'Please wait' },
  detecting: { text: 'Detecting...', sub: 'Keep your finger steady on the lens' },
  stable: { text: 'Stable Reading', sub: 'Heart rate detected successfully' },
  'low-signal': { text: 'Low Signal', sub: 'Increase pressure slightly on the lens' },
  'no-finger': { text: 'No Finger Detected', sub: 'Place your finger over the camera lens' },
  error: { text: 'Camera Error', sub: 'Could not access camera. Check permissions.' },
};

export default function HeartRate() {
  const {
    videoRef, canvasRef, status, bpm, signalData,
    flashEnabled, flashSupported, readings, averageBpm,
    measurementComplete, finalBpm, progress,
    startDetection, stopDetection, resetMeasurement, classifyBpm,
  } = useHeartRateDetection();
  const { setHealthData } = useUser();

  const isActive = status !== 'idle' && status !== 'error';
  const classification = (finalBpm || bpm) ? classifyBpm(finalBpm || bpm!) : null;

  const statusColor =
    status === 'stable' ? 'hsl(var(--success))' :
    status === 'detecting' ? 'hsl(var(--warning))' :
    status === 'no-finger' || status === 'low-signal' || status === 'error' ? 'hsl(var(--destructive))' :
    'hsl(var(--heart))';

  // Save to health data when measurement completes
  useEffect(() => {
    if (measurementComplete && finalBpm) {
      setHealthData(prev => ({
        ...prev,
        heartRate: finalBpm,
        lastHeartRateTime: new Date(),
      }));
    }
  }, [measurementComplete, finalBpm, setHealthData]);

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-md mx-auto pt-4">
        <PageHeader title="Heart Rate" subtitle="Real-time PPG measurement" />

        {/* Hidden canvas for frame processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Measurement Complete Result */}
        <AnimatePresence>
          {measurementComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card rounded-3xl border border-border/50 p-8 mb-4 text-center"
            >
              {finalBpm ? (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle2 className="w-10 h-10 text-success" />
                  </motion.div>

                  <p className="text-sm text-muted-foreground mb-2">Measurement Complete</p>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="text-6xl font-bold text-foreground mb-1">{finalBpm}</div>
                    <div className="text-lg text-muted-foreground mb-4">BPM</div>
                  </motion.div>

                  {classification && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 ${
                        classification.color === 'success' ? 'bg-success/10' :
                        classification.color === 'warning' ? 'bg-warning/10' : 'bg-destructive/10'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        classification.color === 'success' ? 'bg-success' :
                        classification.color === 'warning' ? 'bg-warning' : 'bg-destructive'
                      }`} />
                      <span className={`font-semibold text-sm ${
                        classification.color === 'success' ? 'text-success' :
                        classification.color === 'warning' ? 'text-warning' : 'text-destructive'
                      }`}>
                        {classification.label} Heart Rate
                      </span>
                    </motion.div>
                  )}

                  <div className="text-xs text-muted-foreground mb-6">
                    {finalBpm < 60 && 'Your heart rate is below the normal resting range. This could indicate excellent fitness or may need medical attention if you feel unwell.'}
                    {finalBpm >= 60 && finalBpm <= 100 && 'Your heart rate is within the normal resting range. This indicates a healthy cardiovascular state.'}
                    {finalBpm > 100 && 'Your heart rate is above the normal resting range. This could be due to activity, stress, or caffeine. Consult a doctor if persistent.'}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-10 h-10 text-destructive" />
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-2">Could Not Detect Heart Rate</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Please ensure your finger fully covers the camera lens with gentle pressure. Try again in a well-lit area or with the flash enabled.
                  </p>
                </>
              )}

              <Button
                onClick={resetMeasurement}
                size="lg"
                className="w-full h-14 text-lg rounded-2xl bg-heart hover:bg-heart/90 text-heart-foreground"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                {finalBpm ? 'Measure Again' : 'Try Again'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera Preview / Heart Icon (hidden when complete) */}
        {!measurementComplete && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-3xl border border-border/50 aspect-[4/3] flex items-center justify-center overflow-hidden relative mb-4"
            >
              {isActive ? (
                <>
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 bg-background/40" />
                  <div className="relative z-10 text-center">
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ repeat: Infinity, duration: bpm ? 60 / bpm : 0.8 }}
                      className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ backgroundColor: `${statusColor}20` }}
                    >
                      <Heart className="w-10 h-10" style={{ color: statusColor }} fill="currentColor" />
                    </motion.div>
                    {bpm && (
                      <div className="text-5xl font-bold text-foreground">{bpm} <span className="text-lg text-muted-foreground">BPM</span></div>
                    )}
                  </div>

                  {/* Status indicator dot */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span className="text-xs text-foreground/80 font-medium">
                      {status === 'stable' ? 'LIVE' : 'READING'}
                    </span>
                  </div>

                  {/* Flash indicator */}
                  <div className="absolute top-4 left-4">
                    {flashEnabled ? (
                      <Zap className="w-5 h-5 text-warning" />
                    ) : !flashSupported ? (
                      <div className="flex items-center gap-1">
                        <ZapOff className="w-4 h-4 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Low light</span>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-28 h-28 rounded-full bg-heart/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <Heart className="w-14 h-14 text-heart" />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-foreground">{STATUS_MESSAGES[status].text}</h3>
                  <p className="text-sm text-muted-foreground mt-1 px-8">{STATUS_MESSAGES[status].sub}</p>
                </div>
              )}
            </motion.div>

            {/* Progress bar during measurement */}
            {isActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Measuring...</span>
                  <span className="text-xs font-medium text-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Auto-completes in {Math.max(0, Math.ceil((100 - progress) * 0.3))}s
                </p>
              </motion.div>
            )}

            {/* Status Message (when active) */}
            {isActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
                style={{ backgroundColor: `${statusColor}15` }}
              >
                <Activity className="w-5 h-5 flex-shrink-0" style={{ color: statusColor }} />
                <div>
                  <p className="text-sm font-medium text-foreground">{STATUS_MESSAGES[status].text}</p>
                  <p className="text-xs text-muted-foreground">{STATUS_MESSAGES[status].sub}</p>
                </div>
              </motion.div>
            )}

            {/* Waveform Graph */}
            {isActive && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                <HeartRateWaveform data={signalData} statusColor={statusColor} />
              </motion.div>
            )}

            {/* Start/Stop Button */}
            <Button
              onClick={isActive ? stopDetection : startDetection}
              size="lg"
              className={`w-full h-14 text-lg rounded-2xl ${
                isActive
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                  : 'bg-heart hover:bg-heart/90 text-heart-foreground'
              }`}
            >
              {isActive ? (
                <>Stop Measurement</>
              ) : (
                <><Camera className="w-5 h-5 mr-2" />Start Measurement</>
              )}
            </Button>
          </>
        )}

        {/* Past Readings */}
        {readings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-card rounded-2xl border border-border/50 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Recent Readings</h3>
              {averageBpm && (
                <span className="text-sm text-muted-foreground">Avg: <span className="font-semibold text-foreground">{averageBpm} BPM</span></span>
              )}
            </div>
            <div className="space-y-3">
              {[...readings].reverse().map((reading, i) => {
                const cls = classifyBpm(reading.bpm);
                return (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{reading.timestamp.toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{reading.bpm}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-${cls.color}/10 text-${cls.color}`}>{cls.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
