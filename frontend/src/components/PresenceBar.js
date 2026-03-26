import { Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function PresenceBar({ participants }) {
  const maxShow = 5;
  const shown = participants.slice(0, maxShow);
  const overflow = participants.length - maxShow;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100" data-testid="presence-bar">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-600">{participants.length}</span>
            <div className="flex -space-x-1.5 ml-1">
              {shown.map(p => (
                <div
                  key={p.user_id}
                  className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center"
                  title={p.user_name}
                >
                  <span className="text-[8px] font-bold text-white uppercase">
                    {p.user_name?.charAt(0) || '?'}
                  </span>
                </div>
              ))}
              {overflow > 0 && (
                <div className="w-5 h-5 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center">
                  <span className="text-[8px] font-bold text-slate-600">+{overflow}</span>
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-0.5">
            {participants.map(p => <div key={p.user_id}>{p.user_name}</div>)}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
