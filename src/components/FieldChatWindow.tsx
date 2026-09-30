import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Plus, Send, ShieldCheck, UserCheck, Users, X } from 'lucide-react';
import type { ChatMessage, ChatRoom, ChatUser } from '../types/chat';
import { RoleSwitcher } from './RoleSwitcher';

interface Props {
  rooms: ChatRoom[];
  currentRoom: ChatRoom;
  messages: ChatMessage[];
  currentUser: ChatUser;
  onlineCount: number;
  isConnected: boolean;
  onSelectRoom: (roomId: string) => void;
  onOpenCreateModal: () => void;
  onOpenApprovalModal: () => void;
  pendingApprovalCount: number;
  onOpenSupervisionModal: () => void;
  pendingSupervisionCount: number;
  onSendMessage: (data: { text: string; type?: 'text' | 'image' | 'alert' | 'report'; imageUrl?: string; metadata?: ChatMessage['metadata'] }) => void;
  onChangeUser: (user: ChatUser, code?: string) => void;
  onClose: () => void;
}

export function FieldChatWindow(p: Props) {
  const [text, setText] = useState('');
  const [showRooms, setShowRooms] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [p.messages.length, p.currentRoom.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    p.onSendMessage({ text: t });
    setText('');
  };

  return (
    <div className="fixed z-[9990] inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[26rem] sm:h-[38rem] sm:max-h-[calc(100vh-3rem)] bg-white sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-2">
        <button onClick={() => setShowRooms(!showRooms)} className="min-w-0 text-left cursor-pointer" aria-expanded={showRooms}>
          <p className="text-sm font-bold truncate">{p.currentRoom.name}</p>
          <p className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${p.isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {p.isConnected ? '실시간 연결' : '재연결 중…'}
            <Users className="w-3 h-3" /> {p.onlineCount}명 접속 · ▾ 방 목록
          </p>
        </button>
        <button onClick={p.onClose} aria-label="닫기" className="p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0">
          <X className="w-4 h-4" />
        </button>
      </header>

      {showRooms && (
        <div className="border-b border-slate-200 bg-slate-50 max-h-48 overflow-y-auto">
          {p.rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                p.onSelectRoom(r.id);
                setShowRooms(false);
              }}
              className={`w-full text-left px-4 py-2 text-xs border-b border-slate-100 cursor-pointer ${r.id === p.currentRoom.id ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-white text-slate-700'}`}
            >
              <span className="block truncate">{r.name}</span>
              <span className="text-[10px] text-slate-400">{r.category} · {r.memberCount}명</span>
            </button>
          ))}
          <button onClick={p.onOpenCreateModal} className="w-full px-4 py-2 text-xs font-bold text-indigo-700 flex items-center gap-1.5 hover:bg-white cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> 새 단톡방 개설
          </button>
        </div>
      )}

      <div className="px-3 py-2 border-b border-slate-100 flex flex-wrap gap-1.5">
        <button onClick={p.onOpenApprovalModal} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 cursor-pointer">
          <UserCheck className="w-3.5 h-3.5" /> 입장승인{p.pendingApprovalCount > 0 && ` (${p.pendingApprovalCount})`}
        </button>
        <button onClick={p.onOpenSupervisionModal} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1 cursor-pointer">
          <ShieldCheck className="w-3.5 h-3.5" /> 감리판정{p.pendingSupervisionCount > 0 && ` (${p.pendingSupervisionCount})`}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
        {p.messages.length === 0 && <p className="text-center text-xs text-slate-400 py-10">아직 메시지가 없습니다.</p>}
        {p.messages.map((m) => {
          const mine = m.sender.id === p.currentUser.id;
          if (m.type === 'system') {
            return <p key={m.id} className="text-center text-[11px] text-slate-500 bg-slate-200/60 rounded-lg px-3 py-1.5 whitespace-pre-wrap">{m.text}</p>;
          }
          const special = m.type === 'alert' || m.type === 'report';
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
              <span className="w-7 h-7 rounded-full shrink-0 text-[11px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: m.sender.avatarColor }}>
                {m.sender.name.slice(0, 1)}
              </span>
              <div className={`max-w-[80%] ${mine ? 'items-end' : ''} flex flex-col`}>
                <span className="text-[10px] text-slate-400 mb-0.5">{m.sender.name} · {m.sender.role}</span>
                <div className={`rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap break-words ${m.type === 'alert' ? 'bg-rose-50 border border-rose-300 text-rose-900' : special ? 'bg-indigo-50 border border-indigo-200 text-indigo-950' : mine ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                  {m.type === 'alert' && <AlertTriangle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                  {m.text}
                  {m.imageUrl && <img src={m.imageUrl} alt="첨부 이미지" className="mt-2 rounded-lg max-h-48" />}
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">{m.timestamp}</span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200 p-3 space-y-2 bg-white">
        <RoleSwitcher currentUser={p.currentUser} onChangeUser={p.onChangeUser} />
        <form onSubmit={submit} className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder={`${p.currentUser.name}(으)로 메시지 입력`} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button type="submit" disabled={!text.trim()} aria-label="전송" className="px-3 rounded-xl bg-indigo-600 text-white disabled:opacity-40 cursor-pointer">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
