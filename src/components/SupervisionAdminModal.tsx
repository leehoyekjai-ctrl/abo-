import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { ChatUser, InspectionStatus, SupervisionInspection } from '../types/chat';
import { ModalShell } from './ModalShell';
import { RoleSwitcher } from './RoleSwitcher';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: ChatUser;
  onChangeUser: (user: ChatUser, code?: string) => void;
  inspections: SupervisionInspection[];
  onJudgeInspection: (id: string, judgment: '적합승인' | '조건부승인' | '부적합', notes: string, broadcastToChat: boolean) => void;
  onIssueEmergencyStop: (reason: string) => void;
}

const STATUS_STYLE: Record<InspectionStatus, string> = {
  대기: 'bg-slate-100 text-slate-600',
  적합승인: 'bg-emerald-100 text-emerald-800',
  조건부승인: 'bg-amber-100 text-amber-800',
  부적합: 'bg-rose-100 text-rose-800',
};

export function SupervisionAdminModal({ isOpen, onClose, currentUser, onChangeUser, inspections, onJudgeInspection, onIssueEmergencyStop }: Props) {
  const sorted = [...inspections].sort((a, b) => a.stageNumber - b.stageNumber);
  const firstPending = sorted.find((i) => i.status === '대기');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [broadcast, setBroadcast] = useState(true);
  const [stopReason, setStopReason] = useState('');
  const [showStop, setShowStop] = useState(false);

  useEffect(() => {
    if (isOpen) setSelectedId((prev) => prev ?? firstPending?.id ?? sorted[0]?.id ?? null);
  }, [isOpen, firstPending?.id]);

  const selected = sorted.find((i) => i.id === selectedId) ?? null;
  const isSupervisor = currentUser.userRole === 'supervisor';

  const judge = (j: '적합승인' | '조건부승인' | '부적합') => {
    if (!selected) return;
    if (j !== '적합승인' && !notes.trim()) return;
    onJudgeInspection(selected.id, j, notes.trim() || `${j} 판정`, broadcast);
    setNotes('');
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} wide title="감리원 공식 공정 판정" subtitle="공정 단계별 검사 결과는 법정 감리원만 판정할 수 있습니다.">
      <div className="space-y-4 text-sm">
        <RoleSwitcher currentUser={currentUser} onChangeUser={onChangeUser} needed={['supervisor']} />
        {!isSupervisor && (
          <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5">
            현재 역할({currentUser.name})은 결과 열람만 가능합니다. 판정하려면 감리원으로 전환하세요.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <ul className="md:col-span-2 space-y-1.5 max-h-72 md:max-h-[26rem] overflow-y-auto pr-1">
            {sorted.map((i) => (
              <li key={i.id}>
                <button onClick={() => setSelectedId(i.id)} className={`w-full text-left p-2.5 rounded-lg border text-xs cursor-pointer ${selectedId === i.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-indigo-700">제{i.stageNumber}단계 · {i.stage}</span>
                    <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${STATUS_STYLE[i.status]}`}>{i.status}</span>
                  </div>
                  <p className="mt-1 text-slate-700 line-clamp-2">{i.title}</p>
                </button>
              </li>
            ))}
          </ul>

          <div className="md:col-span-3">
            {selected ? (
              <div className="space-y-3">
                <div>
                  <h3 className="font-bold text-slate-900">{selected.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selected.zone} · {selected.documentNumber}</p>
                </div>
                <p className="text-xs bg-slate-50 rounded-lg p-2.5 text-slate-700">판정 기준: {selected.criteria}</p>
                {selected.measuredValue && <p className="text-xs font-mono bg-slate-50 rounded-lg p-2.5 text-slate-700">실측: {selected.measuredValue}</p>}
                <ul className="space-y-1">
                  {selected.checkpoints.map((c) => (
                    <li key={c.id} className="text-xs flex items-start gap-2">
                      <span className={`mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center text-[10px] font-bold ${c.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{c.passed ? '✓' : '·'}</span>
                      <span className="text-slate-700">{c.label}</span>
                    </li>
                  ))}
                </ul>
                {selected.judgmentNotes && (
                  <p className="text-xs border-l-2 border-indigo-300 pl-2 text-slate-600">
                    {selected.inspectorName} {selected.judgedAt}: {selected.judgmentNotes}
                  </p>
                )}
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="판정 의견 (조건부승인·부적합은 필수)" disabled={!isSupervisor} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:bg-slate-50" />
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={broadcast} onChange={(e) => setBroadcast(e.target.checked)} /> 판정 결과를 단톡방에 공지
                </label>
                <div className="flex flex-wrap gap-2">
                  <button disabled={!isSupervisor} onClick={() => judge('적합승인')} className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> 적합 승인</button>
                  <button disabled={!isSupervisor || !notes.trim()} onClick={() => judge('조건부승인')} className="px-3 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">조건부 승인</button>
                  <button disabled={!isSupervisor || !notes.trim()} onClick={() => judge('부적합')} className="px-3 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">부적합</button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-10">검사 항목을 선택하세요.</p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <button disabled={!isSupervisor} onClick={() => setShowStop(!showStop)} className="text-xs font-bold text-rose-700 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            <AlertTriangle className="w-4 h-4" /> 긴급 작업중지 명령 (감리원 직권)
          </button>
          {showStop && isSupervisor && (
            <div className="mt-2 flex gap-2">
              <input value={stopReason} onChange={(e) => setStopReason(e.target.value)} placeholder="중지 사유 (예: 음압 상실, 비산농도 초과)" className="flex-1 border border-rose-300 rounded-lg px-3 py-2 text-xs" />
              <button
                disabled={!stopReason.trim()}
                onClick={() => {
                  if (!window.confirm('전 구역 작업중지 명령을 발령합니다. 계속할까요?')) return;
                  onIssueEmergencyStop(stopReason.trim());
                  setStopReason('');
                  setShowStop(false);
                }}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white disabled:opacity-40 cursor-pointer"
              >
                발령
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
