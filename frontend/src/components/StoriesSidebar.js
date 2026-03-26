import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusColors = {
  ready: 'bg-slate-200 text-slate-600',
  voting: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

export default function StoriesSidebar({ stories, selectedStoryId, onSelect, isOwner, linkHash, onStoriesUpdate }) {
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const story = await api.createStory(linkHash, { title: newTitle.trim() });
      onSelect(story.id);
      setNewTitle('');
    } catch (e) { toast.error(e.message); }
    finally { setAdding(false); }
  };

  const handleDelete = async (e, storyId) => {
    e.stopPropagation();
    try { await api.deleteStory(storyId); } catch (e) { toast.error(e.message); }
  };

  const handleCsvImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      const storiesToCreate = lines.map(l => {
        const parts = l.split(',');
        return { title: parts[0]?.trim() || 'Untitled', description: parts[1]?.trim() || '' };
      }).filter(s => s.title);
      if (storiesToCreate.length === 0) return;
      try {
        await api.bulkCreateStories(linkHash, storiesToCreate);
        toast.success(`Imported ${storiesToCreate.length} stories`);
      } catch (err) { toast.error(err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="w-72 lg:w-80 border-r border-slate-200 bg-white flex flex-col shrink-0" data-testid="stories-sidebar">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            Stories
          </h2>
          <span className="text-xs text-slate-400 font-mono">{stories.length}</span>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Input
              placeholder="Add story..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="text-sm h-8"
              data-testid="add-story-input"
            />
            <Button size="sm" className="h-8 px-2 bg-blue-600 hover:bg-blue-700 shrink-0" onClick={handleAdd} disabled={adding} data-testid="add-story-button">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
        {isOwner && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 cursor-pointer mt-2 transition-colors">
            <Upload className="w-3 h-3" />
            <span>Import CSV</span>
            <input type="file" accept=".csv,.txt" onChange={handleCsvImport} className="hidden" data-testid="csv-import-input" />
          </label>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {stories.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No stories yet</p>
          )}
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => onSelect(story.id)}
              className={cn(
                'w-full text-left p-3 rounded-lg mb-1 transition-all group',
                selectedStoryId === story.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-slate-50 border border-transparent'
              )}
              data-testid={`story-item-${story.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{story.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider', statusColors[story.status])}>
                      {story.status}
                    </span>
                    {story.avg_points && (
                      <span className="text-xs text-slate-500 font-mono">{story.avg_points} pts</span>
                    )}
                  </div>
                </div>
                {isOwner && (
                  <button
                    onClick={(e) => handleDelete(e, story.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all p-1"
                    data-testid={`delete-story-${story.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
