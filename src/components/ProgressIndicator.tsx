import { motion } from 'framer-motion';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{
            scale: index === currentStep - 1 ? 1.2 : 1,
            opacity: index < currentStep ? 1 : 0.4,
          }}
          className={`h-2 rounded-full transition-all duration-300 ${
            index < currentStep
              ? 'bg-primary w-8'
              : 'bg-muted-foreground/30 w-2'
          }`}
        />
      ))}
      <span className="ml-4 text-sm text-muted-foreground">
        Step {currentStep} of {totalSteps}
      </span>
    </div>
  );
}
