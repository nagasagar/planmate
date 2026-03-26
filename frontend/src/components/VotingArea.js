import { useState, useEffect } from 'react';
import FibonacciCard from '@/components/FibonacciCard';
import { Button } from '@/components/ui/button';
import { Play, Eye, RotateCcw, Clock } from 'lucide-react';

const FIB_VALUES = ['1', '2', '3', '5', '8', '13', '21', '?', '∞', '☕'];

export default function VotingArea({ story, isOwner, myVote, onVote, onStart, onReveal, onReset, timerMinutes }) {
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Start timer when voting begins
  useEffect(() => {
    if (story.status === 'voting') {
      setTimerActive(true);
      setTimeLeft(timerMinutes * 60);
    } else {
      setTimerActive(false);
    }
  }, [story.status, story.id, timerMinutes]);

  // Timer countdown
  useEffect(() => {
    if (!timerActive || timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const isVoting = story.status === 'voting';
  const isCompleted = story.status === 'completed';
  const isReady = story.status === 'ready';

  return (
    <div data-testid="voting-area">
      {/* Story Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight mb-1" style={{ fontFamily: 'var(--font-heading)' }} data-testid="story-title">
            {story.title}
          </h2>
          {story.description && <p className="text-sm text-slate-500">{story.description}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Timer */}
          {isVoting && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono ${timeLeft < 30 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`} data-testid="timer-display">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(timeLeft)}
            </div>
          )}

          {/* PO Controls */}
          {isOwner && (
            <>
              {isReady && (
                <Button onClick={onStart} className="bg-blue-600 hover:bg-blue-700 shadow-sm" data-testid="start-voting-button">
                  <Play className="w-4 h-4 mr-1.5" /> Start Voting
                </Button>
              )}
              {isVoting && (
                <Button onClick={onReveal} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm" data-testid="reveal-button">
                  <Eye className="w-4 h-4 mr-1.5" /> Reveal
                </Button>
              )}
              {isCompleted && (
                <Button onClick={onReset} variant="outline" className="border-slate-300" data-testid="reset-button">
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fibonacci Cards */}
      <div className="flex flex-wrap gap-3" data-testid="fibonacci-cards">
        {FIB_VALUES.map((val) => (
          <FibonacciCard
            key={val}
            value={val}
            selected={myVote === val}
            disabled={!isVoting}
            onClick={() => onVote(val)}
          />
        ))}
      </div>

      {isReady && (
        <p className="text-sm text-slate-400 mt-4">
          {isOwner ? 'Click "Start Voting" to begin estimation' : 'Waiting for the PO to start voting...'}
        </p>
      )}
    </div>
  );
}
