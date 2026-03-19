import { ResponsiveContainer, LineChart, Line, ReferenceDot, YAxis, XAxis } from 'recharts';
import { type SignalPoint } from '@/hooks/useHeartRateDetection';

interface HeartRateWaveformProps {
  data: SignalPoint[];
  statusColor: string;
}

export function HeartRateWaveform({ data, statusColor }: HeartRateWaveformProps) {
  const peaks = data.filter(d => d.isPeak);

  return (
    <div className="w-full h-40 bg-card rounded-2xl border border-border/50 p-3">
      {data.length < 5 ? (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Waiting for signal...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <YAxis hide domain={['auto', 'auto']} />
            <XAxis dataKey="time" hide />
            <Line
              type="monotone"
              dataKey="value"
              stroke={statusColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {peaks.map((peak, i) => (
              <ReferenceDot
                key={`peak-${i}`}
                x={peak.time}
                y={peak.value}
                r={4}
                fill={statusColor}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
