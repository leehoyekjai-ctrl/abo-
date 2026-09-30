export type ConcentrationStatus = 'safe' | 'warning' | 'danger';

export interface ConcentrationPoint {
  id: string;
  time: string;
  date: string;
  zone: string;
  /** 개/cm³ */
  value: number;
  threshold: number;
  status: ConcentrationStatus;
  method: string;
  deviceNo: string;
  inspector: string;
  notes: string;
}

export const CONCENTRATION_THRESHOLD = 0.01;
export const CONCENTRATION_WARNING = 0.008;

export function classifyConcentration(value: number, threshold = CONCENTRATION_THRESHOLD): ConcentrationStatus {
  if (value >= threshold) return 'danger';
  if (value >= threshold * 0.8) return 'warning';
  return 'safe';
}
