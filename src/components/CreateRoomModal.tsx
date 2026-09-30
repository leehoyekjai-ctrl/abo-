import { useState } from 'react';
import { ROOM_CATEGORIES, type ChatRoom, type ChatUser } from '../types/chat';
import { ModalShell } from './ModalShell';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: ChatUser;
  onCreateRoom: (data: { name: string; description: string; category: ChatRoom['category'] }) => void;
}

export function CreateRoomModal({ isOpen, onClose, currentUser, onCreateRoom }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ChatRoom['category']>('현장종합');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateRoom({ name: name.trim(), description: description.trim(), category });
    setName('');
    setDescription('');
    setCategory('현장종합');
    onClose();
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="새 단톡방 개설" subtitle={`개설자: ${currentUser.name} (${currentUser.role})`}>
      <form onSubmit={submit} className="space-y-3 text-sm">
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">방 이름 *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="예: 2층 교실 선행철거 협의방" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">설명</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </label>
        <div>
          <span className="text-xs font-semibold text-slate-600">분류</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ROOM_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${category === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">취소</button>
          <button type="submit" disabled={!name.trim()} className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 cursor-pointer">개설</button>
        </div>
      </form>
    </ModalShell>
  );
}
