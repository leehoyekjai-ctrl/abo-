export type UserRole = 'school_admin' | 'supervisor' | 'contractor' | 'guest';

export interface ChatUser {
  id: string;
  name: string;
  role: string;
  company: string;
  avatarColor: string;
  userRole: UserRole;
  authVerified: boolean;
}

export type RoomCategory = '현장종합' | '공정검사' | '학부모소통' | '긴급상황';

export const ROOM_CATEGORIES: RoomCategory[] = ['현장종합', '공정검사', '학부모소통', '긴급상황'];

export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  category: RoomCategory;
  createdAt: string;
  createdBy: string;
  memberCount: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  sender: ChatUser;
  text: string;
  type: 'text' | 'image' | 'alert' | 'report' | 'system';
  imageUrl?: string;
  metadata?: {
    zone?: string;
    status?: string;
    pressure?: string;
    [key: string]: string | undefined;
  };
  timestamp: string;
}

export type JoinRequestStatus = '대기' | '1차확인' | '승인' | '반려';

export interface ChatJoinRequest {
  id: string;
  roomId: string;
  name: string;
  phone: string;
  affiliation: string;
  role: string;
  fileName: string;
  fileSize: string;
  fileUrl: string;
  memo: string;
  status: JoinRequestStatus;
  requestedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string;
  processedAt?: string;
  processedBy?: string;
  rejectReason?: string;
}

export type InspectionStatus = '대기' | '적합승인' | '조건부승인' | '부적합';

export interface InspectionCheckpoint {
  id: string;
  label: string;
  passed: boolean;
}

export interface SupervisionInspection {
  id: string;
  stage: string;
  stageNumber: number;
  title: string;
  zone: string;
  targetDate: string;
  status: InspectionStatus;
  measuredValue?: string;
  criteria: string;
  checkpoints: InspectionCheckpoint[];
  inspectorName: string;
  inspectorRole: string;
  inspectorLicense: string;
  inspectorAgency: string;
  judgmentNotes?: string;
  judgedAt?: string;
  documentNumber: string;
}

export interface RolePreset {
  role: UserRole;
  name: string;
  title: string;
  company: string;
  avatarColor: string;
  /** 데모용 인증 코드. 서버(AUTH_CODE_*)와 일치해야 감리원·현장대리인 권한이 부여된다. */
  code: string;
}

export const ROLE_PRESETS: RolePreset[] = [
  { role: 'school_admin', name: '박행정', title: '늘푸른고 행정실장 (발주자)', company: '늘푸른고등학교 행정실', avatarColor: '#16a34a', code: 'school-1234' },
  { role: 'supervisor', name: '박감리', title: '특급 감리원', company: '(주)한국석면관리연구원', avatarColor: '#4f46e5', code: 'super-1234' },
  { role: 'contractor', name: '김현장', title: '해체업체 현장대리인', company: '(주)한국안전이엔씨', avatarColor: '#d97706', code: 'field-1234' },
  { role: 'guest', name: '이영희', title: '학부모 안심 모니터링단', company: '늘푸른고 학부모회', avatarColor: '#0891b2', code: '' },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  school_admin: '행정실장',
  supervisor: '감리원',
  contractor: '현장대리인',
  guest: '일반',
};
