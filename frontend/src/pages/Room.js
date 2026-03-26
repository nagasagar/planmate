import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { LayoutGrid, Share2, Copy, Download } from 'lucide-react';
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

  // Fetch room data
  const fetchRoom = useCallback(async () => {
    try {
      const data = await api.getRoom(linkHash);
      setRoom(data);
      setStories(data.stories || []);
      if (!selectedStoryId && data.stories?.length > 0) {
        setSelectedStoryId(data.stories[0].id);
      }
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, [linkHash, selectedStoryId]);

  useEffect(() => { fetchRoom(); }, [fetchRoom]);

  // WebSocket handler
  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'presence_update':
        setParticipants(msg.participants || []);
        break;
      case 'story_added':
        setStories(prev => [...prev, msg.story]);
        break;
      case 'stories_bulk_added':
        setStories(prev => [...prev, ...(msg.stories || [])]);
        break;
      case 'story_updated':
        setStories(prev => prev.map(s => s.id === msg.story.id ? msg.story : s));
        if (msg.story.status === 'voting') {
          setMyVote(null);
          setVotedSet(new Set());
        }
        if (msg.story.status === 'completed' || msg.story.status === 'ready') {
          setMyVote(null);
          setVotedSet(new Set());
        }
        break;
      case 'story_deleted':
        setStories(prev => prev.filter(s => s.id !== msg.story_id));
        break;
      case 'vote_submitted':
        setVotedSet(prev => new Set([...prev, msg.voter_id]));
        break;
      case 'full_state':
        if (msg.data) {
          setRoom(msg.data);
          setStories(msg.data.stories || []);
        }
        break;
      default:
        break;
    }
  }, []);

  const wsReady = user ? true : guestReady;
  useWebSocket(
    wsReady ? linkHash : null,
    currentUserId,
    currentUserName,
    handleWsMessage
  );

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
    } catch (e) { toast.error(e.message); }
  };

  const handleStartVoting = async () => {
    if (!selectedStoryId) return;
    try { await api.updateStory(selectedStoryId, { status: 'voting' }); } catch (e) { toast.error(e.message); }
  };

  const handleReveal = async () => {
    if (!selectedStoryId) return;
    try { await api.updateStory(selectedStoryId, { status: 'completed' }); } catch (e) { toast.error(e.message); }
  };

  const handleReset = async () => {
    if (!selectedStoryId) return;
    try { await api.updateStory(selectedStoryId, { status: 'ready' }); } catch (e) { toast.error(e.message); }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/room/${linkHash}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => toast.success('Link copied!')).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('Link copied!');
      });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('Link copied!');
    }
  };

  const selectedStory = stories.find(s => s.id === selectedStoryId);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-500">Loading room...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-500 mb-4">{error}</p>
        <Button onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50" data-testid="room-page">
      {/* Guest Name Dialog */}
      <Dialog open={showGuestDialog} onOpenChange={setShowGuestDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'var(--font-heading)' }}>Join as Guest</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGuestJoin()}
              data-testid="guest-name-input"
              autoFocus
            />
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleGuestJoin} data-testid="guest-join-button">
              Join Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center cursor-pointer" onClick={() => navigate('/')}>
            <LayoutGrid className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-slate-900 text-sm tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            {room?.name || 'Planning Poker'}
          </span>
          <span className="text-xs text-slate-400 font-mono">{linkHash}</span>
        </div>
        <div className="flex items-center gap-2">
          <PresenceBar participants={participants} />
          <Button variant="outline" size="sm" onClick={handleCopyLink} data-testid="copy-link-button">
            <Copy className="w-3.5 h-3.5 mr-1" /> Share
          </Button>
          {isOwner && (
            <a href={api.getExportUrl(linkHash)} download>
              <Button variant="outline" size="sm" data-testid="export-csv-button">
                <Download className="w-3.5 h-3.5 mr-1" /> CSV
              </Button>
            </a>
          )}
        </div>
      </header>

      {/* Main Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Stories */}
        <StoriesSidebar
          stories={stories}
          selectedStoryId={selectedStoryId}
          onSelect={setSelectedStoryId}
          isOwner={isOwner}
          linkHash={linkHash}
          onStoriesUpdate={setStories}
        />

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-auto p-6 gap-6">
          {selectedStory ? (
            <>
              <VotingArea
                story={selectedStory}
                isOwner={isOwner}
                myVote={myVote}
                onVote={handleVote}
                onStart={handleStartVoting}
                onReveal={handleReveal}
                onReset={handleReset}
                timerMinutes={room?.timer_minutes || 3}
              />
              <VoteTable
                story={selectedStory}
                participants={participants}
                votedSet={votedSet}
                currentUserId={currentUserId}
                myVote={myVote}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Select or add a story to begin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
