import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { User, Check } from 'lucide-react';

export default function VoteTable({ story, participants, votedSet, currentUserId, myVote }) {
  const isCompleted = story.status === 'completed';
  const isVoting = story.status === 'voting';
  const votes = story.votes || [];

  // Build voter list: merge participants + votes
  const voterMap = new Map();
  participants.forEach(p => voterMap.set(p.user_id, { name: p.user_name, id: p.user_id }));
  votes.forEach(v => voterMap.set(v.voter_id, { name: v.voter_name, id: v.voter_id, value: v.value }));

  const voters = Array.from(voterMap.values());

  const getVoteValue = (voterId) => {
    if (isCompleted) {
      const vote = votes.find(v => v.voter_id === voterId);
      return vote?.value || null;
    }
    if (voterId === currentUserId) return myVote;
    return null;
  };

  const hasVoted = (voterId) => {
    if (isCompleted) return !!votes.find(v => v.voter_id === voterId);
    if (voterId === currentUserId) return !!myVote;
    return votedSet.has(voterId) || !!votes.find(v => v.voter_id === voterId);
  };

  return (
    <div data-testid="vote-table">
      <h3 className="text-sm font-semibold text-slate-900 mb-3 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
        Votes
        {isCompleted && story.avg_points && (
          <span className="ml-3 px-2.5 py-1 bg-blue-600 text-white text-xs rounded-full font-mono" data-testid="average-display">
            Avg: {story.avg_points} pts
          </span>
        )}
      </h3>

      {voters.length === 0 ? (
        <p className="text-sm text-slate-400">No participants yet</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <AnimatePresence mode="popLayout">
            {voters.map((voter) => {
              const value = getVoteValue(voter.id);
              const voted = hasVoted(voter.id);

              return (
                <motion.div
                  key={voter.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center gap-2"
                  data-testid={`voter-card-${voter.id}`}
                >
                  {/* Card */}
                  <div className="perspective-1000 w-16 h-24">
                    <motion.div
                      animate={{ rotateY: (isCompleted && value) ? 180 : 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                      className="relative w-full h-full"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      {/* Front - Shows value */}
                      <div
                        className={cn(
                          'absolute inset-0 rounded-xl border-2 flex items-center justify-center backface-hidden',
                          isCompleted ? 'bg-white border-blue-200' : 'bg-white border-slate-200'
                        )}
                        style={{ transform: 'rotateY(180deg)' }}
                      >
                        <span className="text-xl font-bold text-blue-700" style={{ fontFamily: 'var(--font-mono)' }}>
                          {value || '-'}
                        </span>
                      </div>
                      {/* Back */}
                      <div className={cn(
                        'absolute inset-0 rounded-xl border-2 flex items-center justify-center backface-hidden',
                        voted
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-slate-100 border-slate-200'
                      )}
                        style={{
                          backgroundImage: voted ? 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)' : 'none',
                          backgroundSize: '12px 12px',
                        }}
                      >
                        {voted ? (
                          voter.id === currentUserId && myVote && !isCompleted ? (
                            <span className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-mono)' }}>{myVote}</span>
                          ) : (
                            <Check className="w-5 h-5 text-white" />
                          )
                        ) : (
                          <span className="text-xs text-slate-400 uppercase tracking-wider">wait</span>
                        )}
                      </div>
                    </motion.div>
                  </div>
                  {/* Name */}
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-600 truncate max-w-[80px]">{voter.name}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
