import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, ArrowRight, LogOut, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

export default function Landing() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [joinHash, setJoinHash] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!user) { navigate('/auth'); return; }
    setCreating(true);
    try {
      const room = await api.createRoom({ name: roomName || 'Planning Poker' });
      setCreateOpen(false);
      navigate(`/room/${room.link_hash}`);
    } catch (e) {
      toast.error(e.message);
    } finally { setCreating(false); }
  };

  const handleJoin = () => {
    const hash = joinHash.trim();
    if (!hash) return toast.error('Enter a room link or code');
    const extracted = hash.includes('/room/') ? hash.split('/room/').pop() : hash;
    navigate(`/room/${extracted}`);
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="landing-page">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 text-lg tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              Planning Poker
            </span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-slate-600">{user.name}</span>
                <Button variant="ghost" size="sm" onClick={logout} data-testid="logout-button">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate('/auth')} data-testid="login-button">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1
            className="text-4xl sm:text-5xl lg:text-5xl font-bold text-slate-900 tracking-tight mb-4"
            style={{ fontFamily: 'var(--font-heading)' }}
            data-testid="hero-title"
          >
            Estimate together,<br />ship with confidence
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
            Real-time planning poker for agile teams. Create a room, share the link, and start estimating stories collaboratively.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Create Room */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group" data-testid="create-room-card">
                <CardHeader className="pb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <CardTitle className="text-lg" style={{ fontFamily: 'var(--font-heading)' }}>Create Room</CardTitle>
                  <CardDescription>Start a new planning poker session as the Product Owner</CardDescription>
                </CardHeader>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle style={{ fontFamily: 'var(--font-heading)' }}>Create New Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <Input
                  placeholder="Room name (e.g., Sprint 42)"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  data-testid="room-name-input"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleCreate} disabled={creating} data-testid="create-room-button">
                  {creating ? 'Creating...' : 'Create Room'}
                </Button>
                {!user && <p className="text-sm text-slate-500 text-center">You'll need to sign in first</p>}
              </div>
            </DialogContent>
          </Dialog>

          {/* Join Room */}
          <Card className="border-slate-200" data-testid="join-room-card">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-white" />
              </div>
              <CardTitle className="text-lg" style={{ fontFamily: 'var(--font-heading)' }}>Join Room</CardTitle>
              <CardDescription>Enter a room code or paste a link to join as a voter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Room code or link"
                  value={joinHash}
                  onChange={(e) => setJoinHash(e.target.value)}
                  data-testid="join-hash-input"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                />
                <Button onClick={handleJoin} className="bg-slate-800 hover:bg-slate-900 shrink-0" data-testid="join-room-button">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
