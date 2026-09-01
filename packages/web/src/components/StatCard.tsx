import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  variant?: 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose';
  trend?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  subValue,
  icon,
  variant = 'cyan',
  trend,
  className,
}: StatCardProps) {
  const variantStyles = {
    cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-400',
    rose: 'border-rose-500/20 bg-rose-500/5 text-rose-400',
  };

  const glowStyles = {
    cyan: 'shadow-[0_0_20px_rgba(6,182,212,0.08)]',
    emerald: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]',
    amber: 'shadow-[0_0_20px_rgba(245,158,11,0.08)]',
    purple: 'shadow-[0_0_20px_rgba(168,85,247,0.08)]',
    rose: 'shadow-[0_0_20px_rgba(244,63,94,0.08)]',
  };

  return (
    <div
      className={cn(
        'glass-panel relative overflow-hidden rounded-xl p-5 transition-all duration-300 hover:border-slate-700',
        glowStyles[variant],
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', variantStyles[variant])}>
          {icon}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold tracking-tight text-white">{value}</span>
        {trend && <span className="font-mono text-xs text-emerald-400">{trend}</span>}
      </div>

      {subValue && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <span>{subValue}</span>
        </div>
      )}
    </div>
  );
}
