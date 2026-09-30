import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { DEFAULT_CONCENTRATIONS, DEFAULT_INSPECTIONS, DEFAULT_JOIN_REQUESTS } from './src/data/seed';
import { DEFAULT_PROCESS_STEPS, type ProcessStep } from './src/data/processSteps';
import {
  ROLE_PRESETS,
  type ChatJoinRequest,
  type ChatMessage,
  type ChatRoom,
  type ChatUser,
  type InspectionStatus,
  type SupervisionInspection,
  type UserRole,
} from './src/types/chat';
import { classifyConcentration, type ConcentrationPoint } from './src/types/monitoring';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAIN_ROOM_ID = 'room-main';
const MAX_MESSAGES_PER_ROOM = 500;

/* ------------------------------------------------------------------ */
/* Persistence: JSON file, atomic write, debounced                     */
/* ------------------------------------------------------------------ */

interface Database {
  rooms: ChatRoom[];
  messages: ChatMessage[];
  joinRequests: ChatJoinRequest[];
  inspections: SupervisionInspection[];
  concentrations: ConcentrationPoint[];
  processSteps: ProcessStep[];
  maps: Record<string, string>;
  emergencyStop: { active: boolean; reason: string; issuedBy: string; issuedAt: string } | null;
}

const nowTime = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function seedDatabase(): Database {
  const systemUser: ChatUser = {
    id: 'user-system',
    name: '안전관리 시스템',
    role: '자동 알림',
    company: 'AsbestosSafe',
    avatarColor: '#475569',
    userRole: 'guest',
    authVerified: true,
  };
  return {
    rooms: [
      {
        id: MAIN_ROOM_ID,
        name: '늘푸른고 석면해체 종합 안전단톡방',
        description: '석면 해체 현장 실시간 소통방',
        category: '현장종합',
        createdAt: new Date().toISOString(),
        createdBy: '늘푸른고 행정실',
        memberCount: 12,
      },
      {
        id: 'room-inspection',
        name: '감리 공정검사 협의방',
        description: '공정 단계별 감리 검사 및 승인 협의',
        category: '공정검사',
        createdAt: new Date().toISOString(),
        createdBy: '늘푸른고 행정실',
        memberCount: 5,
      },
    ],
    messages: [
      {
        id: uid('msg'),
        roomId: MAIN_ROOM_ID,
        sender: systemUser,
        text: '석면 해체 공사 안전단톡방입니다. 밀폐·해체 착수 전에 LED 등기구와 천정형 시스템 에어컨 등 비석면 부착물 선행 철거 완료를 확인해 주세요.',
        type: 'system',
        timestamp: nowTime(),
      },
    ],
    joinRequests: structuredClone(DEFAULT_JOIN_REQUESTS),
    inspections: structuredClone(DEFAULT_INSPECTIONS),
    concentrations: structuredClone(DEFAULT_CONCENTRATIONS),
    processSteps: structuredClone(DEFAULT_PROCESS_STEPS),
    maps: {},
    emergencyStop: null,
  };
}

function loadDatabase(): Database {
  const seed = seedDatabase();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as Partial<Database>;
    return { ...seed, ...parsed };
  } catch (err: any) {
    if (err?.code !== 'ENOENT') console.warn('[db] 저장 파일을 읽지 못해 초기 데이터로 시작합니다:', err?.message);
    return seed;
  }
}

const db = loadDatabase();
let saveTimer: NodeJS.Timeout | null = null;

function flushDatabase() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  } catch (err: any) {
    console.error('[db] 저장 실패:', err?.message);
  }
}

function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushDatabase();
  }, 300);
}

function trimMessages() {
  const byRoom = new Map<string, number>();
  for (let i = db.messages.length - 1; i >= 0; i--) {
    const count = (byRoom.get(db.messages[i].roomId) ?? 0) + 1;
    byRoom.set(db.messages[i].roomId, count);
    if (count > MAX_MESSAGES_PER_ROOM) db.messages.splice(i, 1);
  }
}

if (!fs.existsSync(DB_FILE)) flushDatabase();

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const roomMessages = (roomId: string) => db.messages.filter((m) => m.roomId === roomId);

function authCodeFor(role: UserRole): string {
  const preset = ROLE_PRESETS.find((p) => p.role === role);
  return process.env[`AUTH_CODE_${role.toUpperCase()}`] || preset?.code || '';
}

const PRIVILEGED: UserRole[] = ['supervisor', 'contractor'];

function isRoomCategory(v: unknown): v is ChatRoom['category'] {
  return typeof v === 'string' && ['현장종합', '공정검사', '학부모소통', '긴급상황'].includes(v);
}

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Domain actions (shared by WebSocket and REST)                       */
/* ------------------------------------------------------------------ */

function addMessage(input: { roomId: string; sender: ChatUser; text: string; type?: ChatMessage['type']; imageUrl?: string; metadata?: ChatMessage['metadata'] }) {
  const message: ChatMessage = {
    id: uid('msg'),
    roomId: input.roomId,
    sender: input.sender,
    text: input.text.slice(0, 4000),
    type: input.type ?? 'text',
    imageUrl: input.imageUrl,
    metadata: input.metadata,
    timestamp: nowTime(),
  };
  db.messages.push(message);
  trimMessages();
  persist();
  return message;
}

function createRoom(input: { name: string; description: string; category: unknown; creatorName: string; creatorRole: string }): ActionResult<ChatRoom> {
  const name = str(input.name, 60);
  if (!name) return { ok: false, error: '단톡방 이름을 입력해 주세요.' };
  const room: ChatRoom = {
    id: uid('room'),
    name,
    description: str(input.description, 200),
    category: isRoomCategory(input.category) ? input.category : '현장종합',
    createdAt: new Date().toISOString(),
    createdBy: `${str(input.creatorName, 40) || '익명'}${input.creatorRole ? ` (${str(input.creatorRole, 60)})` : ''}`,
    memberCount: 1,
  };
  db.rooms.push(room);
  persist();
  return { ok: true, data: room };
}

function submitJoinRequest(input: Record<string, unknown>): ActionResult<ChatJoinRequest> {
  const name = str(input.name, 40);
  const phone = str(input.phone, 30);
  if (!name || !phone) return { ok: false, error: '이름과 연락처는 필수입니다.' };
  const request: ChatJoinRequest = {
    id: uid('req'),
    roomId: str(input.roomId, 80) || MAIN_ROOM_ID,
    name,
    phone,
    affiliation: str(input.affiliation, 80),
    role: str(input.role, 80),
    fileName: str(input.fileName, 200),
    fileSize: str(input.fileSize, 30),
    fileUrl: '#',
    memo: str(input.memo, 500),
    status: '대기',
    requestedAt: nowTime(),
  };
  db.joinRequests.push(request);
  persist();
  return { ok: true, data: request };
}

function processJoinRequest(
  requestId: string,
  action: 'verify' | 'approve' | 'reject',
  role: UserRole,
  input: { by: string; notes?: string; reason?: string },
): ActionResult<ChatJoinRequest> {
  const request = db.joinRequests.find((r) => r.id === requestId);
  if (!request) return { ok: false, error: '입장 신청을 찾을 수 없습니다.' };
  if (request.status === '승인' || request.status === '반려') return { ok: false, error: '이미 처리된 신청입니다.' };

  if (action === 'verify') {
    if (role !== 'contractor') return { ok: false, error: '작업자 서류 1차 확인은 해체업체 현장대리인 권한입니다.' };
    if (request.status !== '대기') return { ok: false, error: '이미 1차 확인된 신청입니다.' };
    request.status = '1차확인';
    request.verifiedAt = nowTime();
    request.verifiedBy = str(input.by, 40);
    request.verificationNotes = str(input.notes, 300);
  } else if (action === 'approve') {
    if (role !== 'supervisor' && role !== 'school_admin') return { ok: false, error: '최종 승인은 감리원 또는 행정실 권한입니다.' };
    request.status = '승인';
    request.processedAt = nowTime();
    request.processedBy = str(input.by, 40);
    const room = db.rooms.find((r) => r.id === request.roomId);
    if (room) room.memberCount += 1;
  } else {
    if (role === 'guest') return { ok: false, error: '반려 권한이 없습니다.' };
    request.status = '반려';
    request.processedAt = nowTime();
    request.processedBy = str(input.by, 40);
    request.rejectReason = str(input.reason, 300);
  }
  persist();
  return { ok: true, data: request };
}

function judgeInspection(
  inspectionId: string,
  role: UserRole,
  input: { status: unknown; notes: unknown; broadcastToChat: boolean; inspector: ChatUser | null; inspectorName: string },
): ActionResult<{ inspection: SupervisionInspection; message?: ChatMessage }> {
  if (role !== 'supervisor') return { ok: false, error: '공정 단계 승인은 법정 감리원의 고유 업무입니다.' };
  const inspection = db.inspections.find((i) => i.id === inspectionId);
  if (!inspection) return { ok: false, error: '검사 항목을 찾을 수 없습니다.' };
  const status = input.status as InspectionStatus;
  if (!['적합승인', '조건부승인', '부적합'].includes(status)) return { ok: false, error: '올바르지 않은 판정입니다.' };

  inspection.status = status;
  inspection.judgmentNotes = str(input.notes, 1000);
  inspection.judgedAt = nowTime();
  inspection.inspectorName = input.inspector?.name || input.inspectorName || inspection.inspectorName;
  if (input.inspector?.role) inspection.inspectorRole = input.inspector.role;
  if (status === '적합승인') inspection.checkpoints.forEach((c) => (c.passed = true));
  persist();

  let message: ChatMessage | undefined;
  if (input.broadcastToChat && input.inspector) {
    const icon = status === '적합승인' ? '✅' : status === '조건부승인' ? '⚠️' : '🚫';
    message = addMessage({
      roomId: MAIN_ROOM_ID,
      sender: input.inspector,
      type: 'report',
      text: `${icon} [감리 공정 판정] 제${inspection.stageNumber}단계 ${inspection.stage}\n■ ${inspection.title}\n■ 판정: ${status}\n■ 의견: ${inspection.judgmentNotes || '-'}\n■ 문서번호: ${inspection.documentNumber}`,
      metadata: { zone: inspection.zone, status },
    });
  }
  return { ok: true, data: { inspection, message } };
}

function addConcentration(input: Record<string, unknown>): ActionResult<ConcentrationPoint> {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0 || value > 100) return { ok: false, error: '농도 값이 올바르지 않습니다.' };
  const threshold = Number(input.threshold) > 0 ? Number(input.threshold) : 0.01;
  const point: ConcentrationPoint = {
    id: uid('conc'),
    time: str(input.time, 10) || nowTime(),
    date: str(input.date, 12) || new Date().toISOString().slice(0, 10),
    zone: str(input.zone, 80) || '미지정 구역',
    value,
    threshold,
    status: classifyConcentration(value, threshold),
    method: str(input.method, 60),
    deviceNo: str(input.deviceNo, 60),
    inspector: str(input.inspector, 80),
    notes: str(input.notes, 500),
  };
  db.concentrations.push(point);
  persist();
  return { ok: true, data: point };
}

/* ------------------------------------------------------------------ */
/* HTTP + WebSocket server                                             */
/* ------------------------------------------------------------------ */

interface ClientSession {
  ws: WebSocket;
  roomId: string;
  user: ChatUser | null;
  role: UserRole;
}

const sessions = new Set<ClientSession>();

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(payload: unknown, filter?: (s: ClientSession) => boolean) {
  for (const s of sessions) if (!filter || filter(s)) send(s.ws, payload);
}

const broadcastPresence = () => broadcast({ type: 'presence_update', onlineUsersCount: Math.max(1, sessions.size) });

async function main() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const roleOf = (req: express.Request): UserRole => {
    const r = req.body?.userRole ?? req.query.userRole;
    return r === 'supervisor' || r === 'contractor' || r === 'school_admin' ? r : 'guest';
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true, persistedTo: DB_FILE }));

  app.get('/api/chat/rooms', (_req, res) => res.json({ rooms: db.rooms }));
  app.post('/api/chat/rooms', (req, res) => {
    const result = createRoom({ ...req.body, creatorName: req.body?.creatorName, creatorRole: req.body?.creatorRole });
    if (!result.ok) return res.status(400).json({ error: result.error });
    broadcast({ type: 'room_created', room: result.data, rooms: db.rooms });
    res.json({ room: result.data, rooms: db.rooms });
  });

  app.get('/api/chat/messages', (req, res) => {
    const roomId = str(req.query.roomId, 80) || MAIN_ROOM_ID;
    res.json({ messages: roomMessages(roomId) });
  });

  app.get('/api/chat/join-requests', (_req, res) => res.json({ requests: db.joinRequests }));
  app.post('/api/chat/join-requests', (req, res) => {
    const result = submitJoinRequest(req.body ?? {});
    if (!result.ok) return res.status(400).json({ error: result.error });
    broadcast({ type: 'join_request_created', request: result.data, requests: db.joinRequests });
    res.json({ request: result.data, requests: db.joinRequests });
  });
  app.patch('/api/chat/join-requests/:id', (req, res) => {
    const action = req.body?.action;
    if (action !== 'verify' && action !== 'approve' && action !== 'reject') return res.status(400).json({ error: '올바르지 않은 요청입니다.' });
    const by = action === 'verify' ? req.body?.verifiedBy : req.body?.processedBy;
    const result = processJoinRequest(req.params.id, action, roleOf(req), {
      by,
      notes: req.body?.verificationNotes,
      reason: req.body?.rejectReason,
    });
    if (!result.ok) return res.status(403).json({ error: result.error });
    broadcast({ type: 'join_request_updated', request: result.data, requests: db.joinRequests, rooms: db.rooms });
    res.json({ request: result.data, requests: db.joinRequests });
  });

  app.get('/api/supervision/inspections', (_req, res) => res.json({ inspections: db.inspections }));
  app.post('/api/supervision/inspections/:id/judge', (req, res) => {
    const result = judgeInspection(req.params.id, roleOf(req), {
      status: req.body?.status,
      notes: req.body?.notes,
      broadcastToChat: false,
      inspector: null,
      inspectorName: str(req.body?.inspectorName, 40),
    });
    if (!result.ok) return res.status(403).json({ error: result.error });
    broadcast({ type: 'inspections_updated', inspections: db.inspections });
    res.json({ inspection: result.data.inspection, inspections: db.inspections });
  });

  app.get('/api/monitoring/concentrations', (_req, res) => res.json({ concentrations: db.concentrations }));
  app.post('/api/monitoring/concentrations', (req, res) => {
    const result = addConcentration(req.body ?? {});
    if (!result.ok) return res.status(400).json({ error: result.error });
    broadcast({ type: 'concentration_added', point: result.data, concentrations: db.concentrations });
    res.json({ point: result.data, concentrations: db.concentrations });
  });

  app.get('/api/process-steps', (_req, res) => res.json({ steps: db.processSteps }));
  app.get('/api/maps', (_req, res) => res.json({ maps: db.maps }));

  if (IS_PROD) {
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const session: ClientSession = { ws, roomId: MAIN_ROOM_ID, user: null, role: 'guest' };
    sessions.add(session);

    send(ws, {
      type: 'init',
      rooms: db.rooms,
      messages: roomMessages(session.roomId),
      joinRequests: db.joinRequests,
      inspections: db.inspections,
      concentrations: db.concentrations,
      onlineUsersCount: Math.max(1, sessions.size),
    });
    broadcastPresence();

    const deny = (message: string) => send(ws, { type: 'action_error', message });

    ws.on('message', (raw) => {
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (data.type) {
        case 'set_user': {
          const u = data.user as ChatUser | undefined;
          if (!u || typeof u.name !== 'string') return;
          // 감리원·현장대리인 권한은 인증 코드로만 부여한다.
          const requested: UserRole = u.userRole;
          if (PRIVILEGED.includes(requested) && session.role !== requested) {
            session.role = 'guest';
          } else if (requested === 'school_admin' || requested === 'guest') {
            session.role = requested;
          }
          session.user = { ...u, userRole: session.role, authVerified: session.role === requested };
          break;
        }

        case 'auth_login': {
          const role = data.role as UserRole;
          const preset = ROLE_PRESETS.find((p) => p.role === role);
          if (!preset) return send(ws, { type: 'auth_result', success: false, message: '알 수 없는 역할입니다.' });
          const expected = authCodeFor(role);
          if (expected && data.code !== expected) {
            return send(ws, { type: 'auth_result', success: false, message: '인증 코드가 올바르지 않습니다.' });
          }
          session.role = role;
          session.user = {
            id: `user-${role}`,
            name: preset.name,
            role: preset.title,
            company: preset.company,
            avatarColor: preset.avatarColor,
            userRole: role,
            authVerified: true,
          };
          send(ws, { type: 'auth_result', success: true, user: session.user });
          break;
        }

        case 'join_room': {
          const roomId = str(data.roomId, 80);
          if (!db.rooms.some((r) => r.id === roomId)) return;
          session.roomId = roomId;
          send(ws, { type: 'room_joined', roomId, messages: roomMessages(roomId) });
          break;
        }

        case 'send_message': {
          if (!session.user) return deny('먼저 참여자 정보를 설정해 주세요.');
          const text = str(data.text, 4000);
          if (!text && !data.imageUrl) return;
          const roomId = str(data.roomId, 80) || session.roomId;
          if (!db.rooms.some((r) => r.id === roomId)) return;
          const type = ['text', 'image', 'alert', 'report'].includes(data.messageType) ? data.messageType : 'text';
          const message = addMessage({ roomId, sender: session.user, text, type, imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined, metadata: data.metadata });
          broadcast({ type: 'new_message', message }, (s) => s.roomId === roomId);
          break;
        }

        case 'create_room': {
          const result = createRoom({ ...data, creatorName: session.user?.name ?? data.creatorName, creatorRole: session.user?.role ?? data.creatorRole });
          if (!result.ok) return deny(result.error);
          broadcast({ type: 'room_created', room: result.data, rooms: db.rooms });
          break;
        }

        case 'submit_join_request': {
          const result = submitJoinRequest(data.request ?? {});
          if (!result.ok) return deny(result.error);
          broadcast({ type: 'join_request_created', request: result.data, requests: db.joinRequests });
          break;
        }

        case 'verify_join_request':
        case 'approve_join_request':
        case 'reject_join_request': {
          const action = data.type === 'verify_join_request' ? 'verify' : data.type === 'approve_join_request' ? 'approve' : 'reject';
          const result = processJoinRequest(str(data.requestId, 80), action, session.role, {
            by: session.user?.name ?? '',
            notes: data.verificationNotes,
            reason: data.rejectReason,
          });
          if (!result.ok) return deny(result.error);
          broadcast({ type: 'join_request_updated', request: result.data, requests: db.joinRequests, rooms: db.rooms });
          break;
        }

        case 'judge_inspection': {
          const result = judgeInspection(str(data.inspectionId, 80), session.role, {
            status: data.status,
            notes: data.notes,
            broadcastToChat: Boolean(data.broadcastToChat),
            inspector: session.user,
            inspectorName: session.user?.name ?? '',
          });
          if (!result.ok) return deny(result.error);
          broadcast({ type: 'inspections_updated', inspections: db.inspections });
          if (result.data.message) broadcast({ type: 'new_message', message: result.data.message }, (s) => s.roomId === MAIN_ROOM_ID);
          break;
        }

        case 'issue_emergency_stop': {
          if (session.role !== 'supervisor') return deny('긴급 작업중지는 감리원 직권으로만 발동할 수 있습니다.');
          db.emergencyStop = { active: true, reason: str(data.reason, 500), issuedBy: session.user?.name ?? '', issuedAt: new Date().toISOString() };
          persist();
          break;
        }

        case 'add_concentration': {
          const result = addConcentration(data);
          if (!result.ok) return deny(result.error);
          broadcast({ type: 'concentration_added', point: result.data, concentrations: db.concentrations });
          break;
        }
      }
    });

    ws.on('close', () => {
      sessions.delete(session);
      broadcastPresence();
    });
    ws.on('error', () => ws.close());
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AsbestosSafe server: http://localhost:${PORT} (${IS_PROD ? 'production' : 'development'})`);
    console.log(`데이터 저장 위치: ${DB_FILE}`);
  });

  const shutdown = () => {
    if (saveTimer) clearTimeout(saveTimer);
    flushDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
