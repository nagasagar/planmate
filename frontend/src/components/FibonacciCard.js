import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Coffee, HelpCircle } from 'lucide-react';

const specialIcons = {
  '☕': Coffee,
  '?': HelpCircle,
};

export default function FibonacciCard({ value, selected, disabled, onClick }) {
  const Icon = specialIcons[value];

  return (
    <motion.button
      whileHover={!disabled ? { y: -4, scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 flex flex-col items-center justify-center transition-colors relative',
        disabled
          ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50'
          : selected
            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-lg'
            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:shadow-md cursor-pointer shadow-sm'
      )}
      data-testid={`fib-card-${value}`}
    >
      {Icon ? (
        <Icon className={cn('w-6 h-6 sm:w-7 sm:h-7', selected ? 'text-blue-600' : 'text-slate-500')} />
      ) : (
        <span className={cn(
          'text-xl sm:text-2xl font-bold',
          value === '∞' ? 'text-2xl sm:text-3xl' : ''
        )} style={{ fontFamily: 'var(--font-mono)' }}>
          {value}
        </span>
      )}
      <span className="text-[9px] uppercase tracking-widest mt-1 text-slate-400 font-medium">
        {value === '☕' ? 'break' : value === '?' ? 'unsure' : value === '∞' ? 'huge' : 'pts'}
      </span>
    </motion.button>
  );
}
