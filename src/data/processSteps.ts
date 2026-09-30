export interface ProcessStep {
  step: number;
  title: string;
  category: string;
  description: string;
  responsible?: string;
  checklist?: string[];
}

/** 학교 석면 해체·제거 표준 공정. 비석면 선행 철거(LED 등기구·천정형 시스템 에어컨)는 밀폐 착수 전에 수행한다. */
export const DEFAULT_PROCESS_STEPS: ProcessStep[] = [
  { step: 1, title: '사전 조사 및 석면지도 확정', category: '사전준비', description: '정밀 석면조사 결과 확정, 작업 신고 및 설명회', responsible: '발주자·해체업체' },
  {
    step: 2,
    title: '집기류 반출 및 출입통제',
    category: '사전준비',
    description: '교실·급식실 집기 반출, 학생·교직원 동선 분리, 출입통제선 설치',
    responsible: '행정실·해체업체',
  },
  {
    step: 3,
    title: '비석면 선행 철거: LED 등기구·천정형 시스템 에어컨 탈거',
    category: '선행철거',
    description: '석면 텍스 밀폐·해체 착수 전에 천장 매달림 설비를 먼저 탈거하고 석면 텍스를 훼손하지 않도록 보관',
    responsible: '전기·설비업체(또는 해체업체 별도 인력)',
    checklist: [
      '분전반 전원 차단 및 잠금·표지(LOTO) 후 등기구 배선 분리',
      '에어컨 냉매 회수(자격자) 후 배관·드레인·통신선 분리, 실내기 반출',
      '석면 텍스 지지부에 직접 고정된 설비는 훼손 없이 분리하고, 어려우면 밀폐 후 습식 해체 단계에서 함께 처리',
      '스프링클러·감지기·스피커 등 소방·방송 설비는 담당 업체와 협의해 임시 조치',
      '설비 주변 보온재·가스켓·배관 피복재의 석면 함유 여부 확인 (함유 시 석면 작업 범위에 포함)',
      '탈거 설비는 비석면 폐기물과 분리 보관하고 재설치 대상 표시',
    ],
  },
  {
    step: 4,
    title: '선행 철거 완료 확인 및 인계',
    category: '선행철거',
    description: '석면업체가 밀폐에 착수하기 전 선행 철거 완료확인서와 잔여 부착물 유무를 감리원이 확인',
    responsible: '감리원·현장대리인',
    checklist: ['선행 철거 완료확인서 수령', '천장 내 잔여 설비·배선 확인', '석면 텍스 파손 여부 사진 기록'],
  },
  { step: 5, title: '위생설비(3실) 설치', category: '위생안전', description: '탈의-샤워-갱의 3실 및 5㎛ 여과필터 설치', responsible: '해체업체' },
  { step: 6, title: '바닥/벽체 0.15mm 불침투성 비닐 밀폐보양', category: '밀폐보양', description: '바닥 2겹, 벽체 1겹 밀폐보양 및 테이핑', responsible: '해체업체' },
  { step: 7, title: '음압기 가동 및 차압(-0.050 mmH2O) 기록', category: '음압유지', description: 'HEPA 필터 음압기 연속 가동', responsible: '해체업체' },
  { step: 8, title: '감리원 사전 보양 검사 승인', category: '감리승인', description: '특급 감리원 입회 전 항목 적합 서명', responsible: '감리원' },
  { step: 9, title: '습식 해체·제거 (텍스 원형 분리)', category: '해체제거', description: '습윤제 충분히 살포 후 나사못 탈거', responsible: '해체업체' },
  { step: 10, title: '폐석면 2중 밀봉 포장 및 올바로시스템 인계', category: '폐기물', description: '0.15mm 비닐 2중 밀봉 및 지정폐기물 표지', responsible: '해체업체' },
  { step: 11, title: 'HEPA 청소기 정밀 흡진 및 고착제 살포', category: '잔재물청소', description: 'M-bar 상부 흡진 및 비산방지제 도포', responsible: '해체업체' },
  { step: 12, title: '감리원 및 학부모 모니터링단 잔재물 검사', category: '잔재물검사', description: '육안 정밀 검사 합격 확인', responsible: '감리원·모니터링단' },
  { step: 13, title: '실내 비산농도 측정(0.010개/cm³ 이하) 및 보양 철거', category: '공기질검사', description: '환경측정원 공기질 적합성적서 확인 후 보양 철거', responsible: '측정기관·감리원' },
  {
    step: 14,
    title: '원상복구: LED 등기구·시스템 에어컨 재설치 및 감리완료보고서 발행',
    category: '복구완료',
    description: '공기질 적합 확인 후 무석면 천장재 마감, 등기구·에어컨 재설치 및 최종 완료보고',
    responsible: '전기·설비업체·감리원',
    checklist: ['무석면 천장재 마감 확인', '등기구 재설치 및 점등 시험', '에어컨 재설치, 냉매 충전 및 시운전', '감리완료보고서 발행'],
  },
];
