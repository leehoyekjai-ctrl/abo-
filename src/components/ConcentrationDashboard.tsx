import { useMemo, useState } from 'react';
import { AlertTriangle, MessageSquare, Plus } from 'lucide-react';
import type { ChatUser } from '../types/chat';
import { CONCENTRATION_THRESHOLD, classifyConcentration, type ConcentrationPoint, type ConcentrationStatus } from '../types/monitoring';

interface Props {
  concentrations: ConcentrationPoint[];
  currentUser: ChatUser;
  onAddConcentration: (point: Omit<ConcentrationPoint, 'id'>) => void;
  onTriggerEmergencyAlert: (reason: string, value: number, zone: string) => void;
  onOpenChat: () => void;
}

const STATUS_LABEL: Record<ConcentrationStatus, string> = { safe: '적합', warning: '주의', danger: '초과' };
const STATUS_STYLE: Record<ConcentrationStatus, string> = {
  safe: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-rose-100 text-rose-800',
};
const METHODS = ['위상차현미경(PCM)', '실시간 광학센서(OPC)', '투과전자현미경(TEM)'];

const today = () => new Date().toISOString().slice(0, 10);
const nowHm = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

function Chart({ points, threshold }: { points: ConcentrationPoint[]; threshold: number }) {
  const W = 640;
  const H = 200;
  const pad = { l: 44, r: 12, t: 12, b: 24 };
  const max = Math.max(threshold * 1.3, ...points.map((p) => p.value));
  const x = (i: number) => pad.l + (points.length <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="비산농도 추이 그래프">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" />
          <text x={pad.l - 6} y={y(max * t) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{(max * t).toFixed(3)}</text>
        </g>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(threshold)} y2={y(threshold)} stroke="#e11d48" strokeDasharray="4 3" />
      <text x={W - pad.r} y={y(threshold) - 4} textAnchor="end" fontSize="10" fill="#e11d48">기준 {threshold}</text>
      <path d={path} fill="none" stroke="#4f46e5" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={p.id}>
          <circle cx={x(i)} cy={y(p.value)} r="3.5" fill={p.status === 'danger' ? '#e11d48' : p.status === 'warning' ? '#f59e0b' : '#4f46e5'}>
            <title>{`${p.time} ${p.zone}: ${p.value.toFixed(4)}`}</title>
          </circle>
          {(i === 0 || i === points.length - 1 || points.length < 9) && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.time}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function ConcentrationDashboard({ concentrations, currentUser, onAddConcentration, onTriggerEmergencyAlert, onOpenChat }: Props) {
  const zones = useMemo(() => Array.from(new Set(concentrations.map((c) => c.zone))), [concentrations]);
  const [zone, setZone] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ zone: '', value: '', method: METHODS[0], deviceNo: '', notes: '' });

  const rows = useMemo(
    () => concentrations.filter((c) => zone === 'all' || c.zone === zone).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [concentrations, zone],
  );
  const latest = rows[rows.length - 1];
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  const exceeded = rows.filter((r) => r.status === 'danger').length;
  const canRecord = currentUser.userRole !== 'guest';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(form.value);
    if (!Number.isFinite(value) || value < 0) return;
    const targetZone = form.zone.trim() || (zone !== 'all' ? zone : '미지정 구역');
    const point: Omit<ConcentrationPoint, 'id'> = {
      time: nowHm(),
      date: today(),
      zone: targetZone,
      value,
      threshold: CONCENTRATION_THRESHOLD,
      status: classifyConcentration(value),
      method: form.method,
      deviceNo: form.deviceNo.trim(),
      inspector: `${currentUser.name} (${currentUser.company})`,
      notes: form.notes.trim(),
    };
    onAddConcentration(point);
    if (point.status === 'danger') onTriggerEmergencyAlert('현장 실측 비산농도 기준치 초과', value, targetZone);
    setForm({ zone: '', value: '', method: METHODS[0], deviceNo: '', notes: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['최근 측정', latest ? `${latest.value.toFixed(4)}` : '-', latest ? STATUS_LABEL[latest.status] : ''],
          ['최고치', max.toFixed(4), `기준 ${CONCENTRATION_THRESHOLD}`],
          ['측정 횟수', String(rows.length), zone === 'all' ? '전체 구역' : zone],
          ['기준 초과', String(exceeded), exceeded > 0 ? '즉시 조치 필요' : '이상 없음'],
        ].map(([label, value, sub]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-[11px] text-slate-500 font-medium">{label}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${label === '기준 초과' && exceeded > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">비산농도 추이 (개/cm³)</h2>
          <div className="flex items-center gap-2">
            <select value={zone} onChange={(e) => setZone(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white max-w-[12rem]">
              <option value="all">전체 구역</option>
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <button onClick={onOpenChat} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer">
              <MessageSquare className="w-3.5 h-3.5" /> 단톡방
            </button>
            <button disabled={!canRecord} onClick={() => setShowForm(!showForm)} title={canRecord ? '' : '측정값 등록은 참여 역할이 필요합니다'} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> 측정값 등록
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 bg-slate-50 rounded-lg p-3 text-xs">
            <input list="zone-list" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} placeholder="측정 구역" className="border border-slate-300 rounded-lg px-2 py-2" />
            <datalist id="zone-list">{zones.map((z) => <option key={z} value={z} />)}</datalist>
            <input required type="number" step="0.0001" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="농도 (개/cm³)" className="border border-slate-300 rounded-lg px-2 py-2" />
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="border border-slate-300 rounded-lg px-2 py-2 bg-white">
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
            <input value={form.deviceNo} onChange={(e) => setForm({ ...form, deviceNo: e.target.value })} placeholder="장비 번호" className="border border-slate-300 rounded-lg px-2 py-2" />
            <button type="submit" className="bg-indigo-600 text-white rounded-lg font-bold py-2 cursor-pointer">등록</button>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="비고" className="sm:col-span-2 lg:col-span-5 border border-slate-300 rounded-lg px-2 py-2" />
          </form>
        )}

        {rows.length > 0 ? <Chart points={rows} threshold={CONCENTRATION_THRESHOLD} /> : <p className="text-xs text-slate-400 text-center py-10">측정 기록이 없습니다.</p>}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              {['시각', '구역', '농도', '판정', '방법', '측정자', '비고', ''].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...rows].reverse().map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap font-mono">{r.date.slice(5)} {r.time}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.zone}</td>
                <td className="px-3 py-2 font-mono font-bold">{r.value.toFixed(4)}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded font-bold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">{r.method}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.inspector}</td>
                <td className="px-3 py-2 text-slate-500 min-w-[12rem]">{r.notes}</td>
                <td className="px-3 py-2">
                  {r.status === 'danger' && (
                    <button onClick={() => onTriggerEmergencyAlert('현장 실측 비산농도 기준치 초과', r.value, r.zone)} className="text-rose-700 font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer">
                      <AlertTriangle className="w-3.5 h-3.5" /> 긴급 공지
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
