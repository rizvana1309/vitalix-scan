import { motion } from 'framer-motion';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  to: string;
  iconBgColor: string;
  iconColor: string;
  delay?: number;
}

export function FeatureCard({
  icon: Icon,
  title,
  subtitle,
  to,
  iconBgColor,
  iconColor,
  delay = 0,
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Link to={to}>
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 flex items-center gap-4 hover:shadow-md hover:border-primary/20 transition-all duration-300 group">
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center ${iconBgColor}`}
          >
            <Icon className={`w-7 h-7 ${iconColor}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </Link>
    </motion.div>
  );
}
