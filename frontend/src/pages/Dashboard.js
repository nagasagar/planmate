import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    fetchRooms();
  }, [user]);

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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-indigo-400">Planmate</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.email}</span>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-white">Logout</button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold">Your Rooms</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium"
          >
            + New Room
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">No rooms yet.</p>
            <p className="text-sm mt-1">Create your first room to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
              <div key={room.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-white text-lg">{room.name || room.link_hash}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {room.story_count ?? 0} stories · {room.completed_count ?? 0} completed
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Created {new Date(room.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-800">
                  <button
                    onClick={() => navigate(`/room/${room.link_hash}`)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-sm py-1.5 rounded-lg"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleCopyLink(room.link_hash)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-sm py-1.5 rounded-lg"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => handleDelete(room.link_hash)}
                    className="bg-red-900 hover:bg-red-800 text-sm px-3 py-1.5 rounded-lg"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Room Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Create New Room</h3>
            <input
              type="text"
              placeholder="Room name (e.g. Sprint 24)"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
