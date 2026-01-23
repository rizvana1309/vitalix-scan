import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  iconBgColor: string;
  iconColor: string;
  delay?: number;
}

export function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  iconBgColor,
  iconColor,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-card rounded-2xl p-4 shadow-sm border border-border/50"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBgColor}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
    </motion.div>
  );
}
