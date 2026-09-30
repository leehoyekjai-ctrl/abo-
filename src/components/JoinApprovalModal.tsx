import { useState } from 'react';
import { CheckCircle2, FileText, Plus, XCircle } from 'lucide-react';
import type { ChatJoinRequest, ChatUser, JoinRequestStatus } from '../types/chat';
import { ModalShell } from './ModalShell';
import { RoleSwitcher } from './RoleSwitcher';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requests: ChatJoinRequest[];
  onVerify: (requestId: string, notes?: string) => void;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string, reason: string) => void;
  onSubmitNewRequest: (data: Omit<ChatJoinRequest, 'id' | 'requestedAt' | 'status'>) => void;
  currentUser: ChatUser;
  onChangeUser: (user: ChatUser, code?: string) => void;
  roomId: string;
  roomName: string;
}

const STATUS_STYLE: Record<JoinRequestStatus, string> = {
  대기: 'bg-slate-100 text-slate-700',
  '1차확인': 'bg-sky-100 text-sky-800',
  승인: 'bg-emerald-100 text-emerald-800',
  반려: 'bg-rose-100 text-rose-800',
};

const EMPTY_FORM = { name: '', phone: '', affiliation: '', role: '', memo: '', fileName: '', fileSize: '' };

const formatSize = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function JoinApprovalModal({ isOpen, onClose, requests, onVerify, onApprove, onReject, onSubmitNewRequest, currentUser, onChangeUser, roomId, roomName }: Props) {
  const [tab, setTab] = useState<'list' | 'new'>('list');
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [form, setForm] = useState(EMPTY_FORM);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const role = currentUser.userRole;
  const canVerify = role === 'contractor';
  const canDecide = role === 'supervisor' || role === 'school_admin';

  const roomRequests = requests.filter((r) => r.roomId === roomId);
  const visible = roomRequests.filter((r) => filter === 'all' || r.status === '대기' || r.status === '1차확인');

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitNewRequest({ ...form, roomId, fileUrl: '#' });
    setForm(EMPTY_FORM);
    setTab('list');
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} wide title="단톡방 입장 승인 관리" subtitle={`${roomName} · 현장대리인 1차 서류확인 → 감리원/행정실 최종 승인`}>
      <div className="space-y-4 text-sm">
        <RoleSwitcher currentUser={currentUser} onChangeUser={onChangeUser} needed={['contractor', 'supervisor']} />

        <div className="flex items-center justify-between gap-2">
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
            {(['list', 'new'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${tab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>
                {t === 'list' ? `신청 목록 (${roomRequests.length})` : '입장 신청하기'}
              </button>
            ))}
          </div>
          {tab === 'list' && (
            <select value={filter} onChange={(e) => setFilter(e.target.value as 'active' | 'all')} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
              <option value="active">처리 대기</option>
              <option value="all">전체</option>
            </select>
          )}
        </div>

        {tab === 'list' ? (
          <ul className="space-y-3">
            {visible.length === 0 && <li className="text-center text-xs text-slate-400 py-8">표시할 신청이 없습니다.</li>}
            {visible.map((r) => {
              const open = r.status === '대기' || r.status === '1차확인';
              return (
                <li key={r.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">
                        {r.name} <span className="text-xs font-normal text-slate-500">· {r.phone}</span>
                      </p>
                      <p className="text-xs text-slate-500">{r.affiliation} · {r.role}</p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded shrink-0 ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  </div>
                  {r.memo && <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2">{r.memo}</p>}
                  {r.fileName && (
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> {r.fileName} {r.fileSize && <span className="text-slate-400">({r.fileSize})</span>}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    신청 {r.requestedAt}
                    {r.verifiedBy && ` · 1차확인 ${r.verifiedBy} ${r.verifiedAt ?? ''}`}
                    {r.processedBy && ` · ${r.status} ${r.processedBy} ${r.processedAt ?? ''}`}
                  </p>
                  {r.rejectReason && <p className="text-xs text-rose-700">반려 사유: {r.rejectReason}</p>}

                  {open && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {r.status === '대기' && (
                        <button disabled={!canVerify} onClick={() => onVerify(r.id)} title={canVerify ? '' : '현장대리인만 1차 확인할 수 있습니다'} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                          1차 서류 확인
                        </button>
                      )}
                      <button disabled={!canDecide} onClick={() => onApprove(r.id)} title={canDecide ? '' : '감리원 또는 행정실만 최종 승인할 수 있습니다'} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 최종 승인
                      </button>
                      <button disabled={role === 'guest'} onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> 반려
                      </button>
                    </div>
                  )}
                  {rejectingId === r.id && (
                    <div className="flex gap-2">
                      <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="반려 사유" className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-xs" />
                      <button
                        disabled={!rejectReason.trim()}
                        onClick={() => {
                          onReject(r.id, rejectReason.trim());
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white disabled:opacity-40 cursor-pointer"
                      >
                        반려 확정
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <form onSubmit={submitNew} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([['name', '이름 *', true], ['phone', '연락처 *', true], ['affiliation', '소속', false], ['role', '역할·직책', false]] as const).map(([key, label, required]) => (
              <label key={key} className="block">
                <span className="text-xs font-semibold text-slate-600">{label}</span>
                <input required={required} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
            ))}
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">신청 사유</span>
              <textarea rows={2} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">증빙 서류 (파일명만 기록됩니다)</span>
              <input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setForm({ ...form, fileName: f?.name ?? '', fileSize: f ? formatSize(f.size) : '' });
                }}
                className="mt-1 block w-full text-xs"
              />
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> 신청서 제출
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalShell>
  );
}
