import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutGrid, Copy, Trash2, Plus, LogOut } from 'lucide-react';

export default function Dashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Wait until auth check completes before redirecting
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    fetchRooms();
  }, [user, authLoading, navigate]);

  const fetchRooms = async () => {
    try {
      const data = await api.getRooms();
      setRooms(data);
    } catch (e) {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newRoomName.trim()) return;
    setCreating(true);
    try {
      const room = await api.createRoom({ name: newRoomName });
      toast.success('Room created!');
      navigate(`/room/${room.link_hash}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCreating(false);
      setShowModal(false);
      setNewRoomName('');
    }
  };

  const handleCopyLink = (linkHash) => {
    const url = `${window.location.origin}/room/${linkHash}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  const handleDelete = async (linkHash) => {
    if (!window.confirm('Delete this room?')) return;
    try {
      await api.deleteRoom(linkHash);
      setRooms(rooms.filter(r => r.link_hash !== linkHash));
      toast.success('Room deleted');
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Show nothing while auth is being verified
  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header — matches AuthPage/Room style */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg">Planmate</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-1" /> Logout
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold">Your Rooms</h2>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Room
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading rooms...</p>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">No rooms yet.</p>
            <p className="text-sm mt-1">Create your first room to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
              <Card key={room.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-3">
                  <div>
                    <h3 className="font-semibold text-base">{room.name || room.link_hash}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {room.story_count ?? 0} stories · {room.completed_count ?? 0} completed
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(room.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-auto pt-3 border-t">
                    <Button size="sm" className="flex-1" onClick={() => navigate(`/room/${room.link_hash}`)}>
                      Open
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCopyLink(room.link_hash)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(room.link_hash)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* New Room Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm mx-4">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New Room</h3>
              <Input
                placeholder="Room name (e.g. Sprint 24)"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="mb-4"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => { setShowModal(false); setNewRoomName(''); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
