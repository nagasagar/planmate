import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import StoriesSidebar from '@/components/StoriesSidebar';
import VotingArea from '@/components/VotingArea';
import VoteTable from '@/components/VoteTable';
import PresenceBar from '@/components/PresenceBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LayoutGrid, Share2, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function Room() {
  const { linkHash } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [stories, setStories] = useState([]);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [votedSet, setVotedSet] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Guest state
  const [guestName, setGuestName] = useState('');
  const [guestId, setGuestId] = useState('');
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestReady, setGuestReady] = useState(false);

  const isOwner = room && user && room.owner_id === user.id;
  const currentUserId = user?.id || guestId;
  const currentUserName = user?.name || guestName;

  // Init guest from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem(`poker_guest_name_${linkHash}`);
    const savedId = localStorage.getItem(`poker_guest_id_${linkHash}`);
    if (savedName && savedId) {
      setGuestName(savedName);
      setGuestId(savedId);
      setGuestReady(true);
    } else if (!user) {
      setShowGuestDialog(true);
    }
  }, [linkHash, user]);

  const handleGuestJoin = () => {
    if (!guestName.trim()) return;
    const id = `guest_${crypto.randomUUID().slice(0, 8)}`;
    setGuestId(id);
    localStorage.setItem(`poker_guest_name_${linkHash}`, guestName);
    localStorage.setItem(`poker_guest_id_${linkHash}`, id);
    setShowGuestDialog(false);
    setGuestReady(true);
  };

  // Add self to participants immediately on join
  useEffect(() => {
    if (!currentUserId || !currentUserName) return;
    setParticipants(prev => {
      if (prev.find(p => p.id === currentUserId)) return prev;
      return [...prev, { id: currentUserId, name: currentUserName }];
    });
  }, [currentUserId, currentUserName]);

  // Fetch room data
  const fetchRoom = useCallback(async () => {
    try {
      const data = await api.getRoom(linkHash);
      setRoom(data);
      setStories(data.stories || []);
      if (!selectedStoryId && data.stories?.length > 0) {
        setSelectedStoryId(data.stories[0].id);
      }
      // Seed participants from existing votes on active story
      if (data.stories) {
        const voterMap = new Map();
        data.stories.forEach(story => {
          (story.votes || []).forEach(vote => {
            if (!voterMap.has(vote.voter_id)) {
              voterMap.set(vote.voter_id, { id: vote.voter_id, name: vote.voter_name });
            }
          });
        });
        if (voterMap.size > 0) {
          setParticipants(prev => {
            const merged = [...prev];
            voterMap.forEach((voter) => {
              if (!merged.find(p => p.id === voter.id)) merged.push(voter);
            });
            return merged;
          });
        }
      }
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [linkHash, selectedStoryId]);

  useEffect(() => { fetchRoom(); }, [fetchRoom]);

  // WebSocket handler
  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'presence_update':
        setParticipants(prev => {
          // Merge server presence with local self (avoid losing self on update)
          const incoming = msg.participants || [];
          return incoming.length > 0 ? incoming : prev;
        });
        break;
      case 'story_added':
        setStories(prev => [...prev, msg.story]);
        break;
      case 'stories_bulk_added':
        setStories(prev => [...prev, ...(msg.stories || [])]);
        break;
      case 'story_updated':
        setStories(prev => prev.map(s => s.id === msg.story.id ? msg.story : s));
        if (['voting', 'completed', 'ready'].includes(msg.story.status)) {
          setMyVote(null);
          setVotedSet(new Set());
        }
        break;
      case 'story_deleted':
        setStories(prev => prev.filter(s => s.id !== msg.story_id));
        break;
      case 'vote_submitted':
        setVotedSet(prev => new Set([...prev, msg.voter_id]));
        // Also add voter to participants if not already there
        if (msg.voter_id && msg.voter_name) {
          setParticipants(prev => {
            if (prev.find(p => p.id === msg.voter_id)) return prev;
            return [...prev, { id: msg.voter_id, name: msg.voter_name }];
          });
        }
        break;
      case 'full_state':
        if (msg.data) {
          setRoom(msg.data);
          setStories(msg.data.stories || []);
          // Extract participants from votes (polling fallback)
          if (msg.data.stories) {
            const voterMap = new Map();
            msg.data.stories.forEach(story => {
              (story.votes || []).forEach(vote => {
                if (!voterMap.has(vote.voter_id)) {
                  voterMap.set(vote.voter_id, { id: vote.voter_id, name: vote.voter_name });
                }
              });
            });
            if (voterMap.size > 0) {
              setParticipants(prev => {
                const merged = [...prev];
                voterMap.forEach(voter => {
                  if (!merged.find(p => p.id === voter.id)) merged.push(voter);
                });
                return merged;
              });
            }
          }
        }
        break;
      default:
        break;
    }
  }, []);

  const wsReady = user ? true : guestReady;
  useWebSocket(wsReady ? linkHash : null, currentUserId, currentUserName, handleWsMessage);

  // Actions
  const handleVote = async (value) => {
    const story = stories.find(s => s.id === selectedStoryId);
    if (!story || story.status !== 'voting') return;
    setMyVote(value);
    try {
      await api.submitVote(selectedStoryId, {
        voter_name: currentUserName,
        voter_id: currentUserId,
        value
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleStartVoting = async () => {
    if (!selectedStoryId) return;
    try { await api.updateStory(selectedStoryId, { status: 'voting' }); }
    catch (e) { toast.error(e.message); }
  };

  const handleReveal = async () => {
    if (!selectedStoryId) return;
    try { await api.updateStory(selectedStoryId, { status: 'completed' }); }
    catch (e) { toast.error(e.message); }
  };

  const handleReset = async () => {
    if (!selectedStoryId) return;
    try { await api.updateStory(selectedStoryId, { status: 'ready' }); }
    catch (e) { toast.error(e.message); }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/room/${linkHash}`;
    navigator.clipboard?.writeText(url)
      .then(() => toast.success('Link copied!'))
      .catch(() => {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast.success('Link copied!');
      });
  };

  const selectedStory = stories.find(s => s.id === selectedStoryId);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Loading room...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-destructive">{error}</p>
      <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Guest Name Dialog */}
      <Dialog open={showGuestDialog} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join as Guest</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGuestJoin()}
            data-testid="guest-name-input"
            autoFocus
          />
          <Button onClick={handleGuestJoin} className="w-full mt-2">Join Room</Button>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <LayoutGrid className="w-5 h-5 text-primary" />
          <span className="font-bold">{room?.name || 'Planning Poker'}</span>
          <span className="text-xs text-muted-foreground ml-1">{linkHash}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <Share2 className="w-4 h-4 mr-1" /> Share
          </Button>
          {isOwner && (
            <a href={api.getExportUrl(linkHash)}>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Main Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 border-r shrink-0 overflow-y-auto">
          <StoriesSidebar
            stories={stories}
            selectedStoryId={selectedStoryId}
            onSelect={setSelectedStoryId}
            isOwner={isOwner}
            linkHash={linkHash}
          />
        </div>

        {/* Right Panel */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {selectedStory ? (
            <>
              <VotingArea
                story={selectedStory}
                myVote={myVote}
                onVote={handleVote}
                isOwner={isOwner}
                onStartVoting={handleStartVoting}
                onReveal={handleReveal}
                onReset={handleReset}
              />
              <div className="px-6 pb-6">
                <PresenceBar participants={participants} votedSet={votedSet} />
                <VoteTable
                  story={selectedStory}
                  participants={participants}
                  myVote={myVote}
                  currentUserId={currentUserId}
                  votedSet={votedSet}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select or add a story to begin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
