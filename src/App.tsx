import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Shield,
  Radio,
  Users,
  Bell,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Flame,
  Activity,
  FileCheck,
  MapPin,
  Layers,
  Building2,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { ChatRoom, ChatMessage, ChatUser, ChatJoinRequest, SupervisionInspection, ROLE_PRESETS } from './types/chat';
import { ConcentrationPoint } from './types/monitoring';
import { ConcentrationDashboard } from './components/ConcentrationDashboard';
import { FieldChatWindow } from './components/FieldChatWindow';
import { CreateRoomModal } from './components/CreateRoomModal';
import { JoinApprovalModal } from './components/JoinApprovalModal';
import { SupervisionAdminModal } from './components/SupervisionAdminModal';

import { DEFAULT_CONCENTRATIONS, DEFAULT_INSPECTIONS, DEFAULT_JOIN_REQUESTS } from './data/seed';
import { DEFAULT_PROCESS_STEPS, type ProcessStep } from './data/processSteps';


export default function App() {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'process' | 'map'>('monitoring');
  const [isOpen, setIsOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isSupervisionModalOpen, setIsSupervisionModalOpen] = useState(false);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string>('room-main');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [concentrations, setConcentrations] = useState<ConcentrationPoint[]>(DEFAULT_CONCENTRATIONS);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [maps, setMaps] = useState<Record<string, string>>({});
  const [selectedFloor, setSelectedFloor] = useState<string>('1층');
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [inspections, setInspections] = useState<SupervisionInspection[]>(DEFAULT_INSPECTIONS);

  const [joinRequests, setJoinRequests] = useState<ChatJoinRequest[]>(DEFAULT_JOIN_REQUESTS);

  const [currentUser, setCurrentUser] = useState<ChatUser>({
    id: 'user-manager',
    name: '박행정',
    role: '늘푸른고 행정실장 (발주자)',
    company: '늘푸른고등학교 행정실',
    avatarColor: '#16a34a',
    userRole: 'school_admin',
    authVerified: true,
  });

  const wsRef = useRef<WebSocket | null>(null);
  // WebSocket/interval 콜백은 첫 렌더의 값을 캡처하므로 최신 값은 ref로 읽는다.
  const isOpenRef = useRef(isOpen);
  const currentRoomIdRef = useRef(currentRoomId);
  const currentUserRef = useRef(currentUser);
  const isConnectedRef = useRef(false);
  isOpenRef.current = isOpen;
  currentRoomIdRef.current = currentRoomId;
  currentUserRef.current = currentUser;
  const reconnectTimeoutRef = useRef<any>(null);

  // Show temporary toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Fetch initial rooms & requests via REST
  const fetchInitialData = async () => {
    try {
      const res = await fetch('/api/chat/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data.rooms && data.rooms.length > 0) {
          setRooms(data.rooms);
        }
      }

      const msgRes = await fetch(`/api/chat/messages?roomId=${currentRoomIdRef.current}`);
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        if (msgData.messages) {
          setMessages(msgData.messages);
        }
      }

      const reqRes = await fetch(`/api/chat/join-requests?roomId=${currentRoomIdRef.current}`);
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        if (reqData.requests) {
          setJoinRequests(reqData.requests);
        }
      }

      const inspRes = await fetch('/api/supervision/inspections');
      if (inspRes.ok) {
        const inspData = await inspRes.json();
        if (inspData.inspections) {
          setInspections(inspData.inspections);
        }
      }

      const concRes = await fetch('/api/monitoring/concentrations');
      if (concRes.ok) {
        const concData = await concRes.json();
        if (concData.concentrations && concData.concentrations.length > 0) {
          setConcentrations(concData.concentrations);
        }
      }

      const stepsRes = await fetch('/api/process-steps');
      if (stepsRes.ok) {
        const stepsData = await stepsRes.json();
        if (stepsData.steps) {
          setProcessSteps(stepsData.steps);
        }
      }

      const mapsRes = await fetch('/api/maps');
      if (mapsRes.ok) {
        const mapsData = await mapsRes.json();
        if (mapsData.maps) {
          setMaps(mapsData.maps);
        }
      }
    } catch (err) {
      console.warn('Initial REST fetch fallback:', err);
    }
  };

  // Connect to WebSocket
  const connectWebSocket = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        isConnectedRef.current = true;
        const user = currentUserRef.current;
        const preset = ROLE_PRESETS.find((r) => r.role === user.userRole);
        if (preset && (user.userRole === 'supervisor' || user.userRole === 'contractor')) {
          // 재연결 시 서버 세션 권한이 초기화되므로 다시 인증한다.
          ws.send(JSON.stringify({ type: 'auth_login', code: preset.code, role: user.userRole }));
        } else {
          ws.send(JSON.stringify({ type: 'set_user', user }));
        }
        ws.send(JSON.stringify({ type: 'join_room', roomId: currentRoomIdRef.current }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'init': {
              if (data.rooms) setRooms(data.rooms);
              if (data.messages) setMessages(data.messages);
              if (data.joinRequests) setJoinRequests(data.joinRequests);
              if (data.inspections) setInspections(data.inspections);
              if (data.concentrations && data.concentrations.length > 0) {
                setConcentrations(data.concentrations);
              }
              if (data.onlineUsersCount) setOnlineCount(data.onlineUsersCount);
              break;
            }

            case 'concentration_added': {
              if (data.concentrations) setConcentrations(data.concentrations);
              if (data.point) {
                if (data.point.value >= 0.010) {
                  triggerToast(`🚨 [비산농도 임계값 초과] ${data.point.zone} 실측치 ${data.point.value.toFixed(4)}개/cm³ (기준치 초과)!`);
                } else if (data.point.value >= 0.008) {
                  triggerToast(`⚠️ [비산농도 주의] ${data.point.zone} 실측치 ${data.point.value.toFixed(4)}개/cm³ (주의 구간)`);
                } else {
                  triggerToast(`📊 [비산농도 기록] ${data.point.zone} ${data.point.value.toFixed(4)}개/cm³ (적합)`);
                }
              }
              break;
            }

            case 'room_joined': {
              if (data.messages) setMessages(data.messages);
              break;
            }

            case 'new_message': {
              const msg: ChatMessage = data.message;
              setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
              });

              if (!isOpenRef.current) {
                setUnreadCount((c) => c + 1);
                triggerToast(`💬 [${msg.sender.name}] ${msg.text.slice(0, 35)}...`);
              }
              break;
            }

            case 'rooms_updated': {
              if (data.rooms) setRooms(data.rooms);
              break;
            }

            case 'room_created': {
              const newRoom: ChatRoom = data.room;
              setRooms(data.rooms);
              triggerToast(`🎉 새 단톡방 '${newRoom.name}'이(가) 개설되었습니다!`);
              break;
            }

            case 'join_request_created': {
              if (data.requests) setJoinRequests(data.requests);
              triggerToast(`📥 [입장 승인 신청] '${data.request.name}'(${data.request.affiliation}) 님이 단톡방 입장을 신청했습니다.`);
              break;
            }

            case 'join_request_updated': {
              if (data.requests) setJoinRequests(data.requests);
              if (data.rooms) setRooms(data.rooms);
              if (data.request?.status === '승인') {
                triggerToast(`✅ [입장 최종 승인] '${data.request.name}' 님의 입장이 최종 승인되었습니다.`);
              } else if (data.request?.status === '1차확인') {
                triggerToast(`📋 [1차 확인 완료] 현장대리인이 '${data.request.name}' 님의 서류 1차 적격 확인을 완료하였습니다.`);
              } else if (data.request?.status === '반려') {
                triggerToast(`🚫 [입장 신청 반려] '${data.request.name}' 님의 신청이 반려되었습니다.`);
              }
              break;
            }

            case 'inspections_updated': {
              if (data.inspections) setInspections(data.inspections);
              break;
            }

            case 'action_error': {
              triggerToast(`⚠️ [권한 거부] ${data.message}`);
              break;
            }

            case 'auth_result': {
              if (data.success && data.user) {
                setCurrentUser(data.user);
                triggerToast(`🔑 [권한 인증 성공] '${data.user.name}' (${data.user.role}) 모드로 적용되었습니다.`);
              } else if (data.message) {
                triggerToast(`🚫 [인증 실패] ${data.message}`);
              }
              break;
            }

            case 'presence_update': {
              if (data.onlineUsersCount) setOnlineCount(data.onlineUsersCount);
              break;
            }
          }
        } catch (err) {
          console.warn('Error handling WS message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        isConnectedRef.current = false;
        // Auto reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection status:', err);
        try {
          ws.close();
        } catch (_) {}
      };

      wsRef.current = ws;
    } catch (err) {
      console.warn('Failed to initialize WebSocket:', err);
    }
  };

  useEffect(() => {
    fetchInitialData();
    connectWebSocket();

    // WebSocket이 끊겨 있을 때만 REST로 주기 동기화
    const syncInterval = setInterval(() => {
      if (!isConnectedRef.current) fetchInitialData();
    }, 6000);

    return () => {
      clearInterval(syncInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Handle Room Switching
  const handleSelectRoom = (roomId: string) => {
    setCurrentRoomId(roomId);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'join_room',
        roomId,
      }));
    } else {
      // Fallback via REST
      fetch(`/api/chat/messages?roomId=${roomId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages) setMessages(data.messages);
        });
    }
  };

  // Handle Send Message
  const handleSendMessage = (data: {
    text: string;
    type?: 'text' | 'image' | 'alert' | 'report';
    imageUrl?: string;
    metadata?: ChatMessage['metadata'];
  }) => {
    const payload = {
      type: 'send_message',
      roomId: currentRoomId,
      text: data.text,
      messageType: data.type || 'text',
      imageUrl: data.imageUrl,
      metadata: data.metadata,
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      // Optimistic update
      const optimisticMsg: ChatMessage = {
        id: 'msg-' + Date.now(),
        roomId: currentRoomId,
        sender: currentUser,
        text: data.text,
        type: data.type || 'text',
        imageUrl: data.imageUrl,
        metadata: data.metadata,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      };
      setMessages((prev) => [...prev, optimisticMsg]);
    }
  };

  // Handle User Persona Change
  const handleChangeUser = (newUser: ChatUser, code?: string) => {
    setCurrentUser(newUser);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (code) {
        wsRef.current.send(JSON.stringify({
          type: 'auth_login',
          code,
          role: newUser.userRole,
        }));
      } else {
        wsRef.current.send(JSON.stringify({
          type: 'set_user',
          user: newUser,
        }));
      }
    }
    triggerToast(`👤 대화 참여자가 '${newUser.name} (${newUser.role})'(으)로 변경되었습니다.`);
  };

  // Handle Create New Room
  const handleCreateRoom = (roomData: {
    name: string;
    description: string;
    category: ChatRoom['category'];
  }) => {
    const payload = {
      type: 'create_room',
      name: roomData.name,
      description: roomData.description,
      category: roomData.category,
      creatorName: currentUser.name,
      creatorRole: currentUser.role,
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      // Fallback via REST API
      fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.rooms) setRooms(data.rooms);
          if (data.room) handleSelectRoom(data.room.id);
        });
    }

    triggerToast(`✨ 새 단톡방 '${roomData.name}' 개설 요청이 전송되었습니다.`);
  };

  // Handle 1st Verification by Contractor
  const handleVerifyJoinRequest = async (requestId: string, notes?: string) => {
    if (currentUser.userRole !== 'contractor') {
      triggerToast('⚠️ 작업자 서류 1차 확인은 해체업체 현장대리인(김현장)의 고유 권한입니다.');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'verify_join_request',
        requestId,
        verifiedBy: currentUser.name,
        verificationNotes: notes,
      }));
      return;
    } else {
      try {
        const res = await fetch(`/api/chat/join-requests/${requestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'verify',
            verifiedBy: currentUser.name,
            verificationNotes: notes,
            userRole: currentUser.userRole,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          triggerToast('⚠️ ' + (errData.error || '1차 확인 권한이 없습니다.'));
          return;
        }
      } catch (err) {
        console.warn('Failed to verify join request:', err);
        triggerToast('⚠️ 서버에 연결할 수 없어 처리하지 못했습니다.');
        return;
      }
    }

    setJoinRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: '1차확인',
              verifiedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
              verifiedBy: currentUser.name,
              verificationNotes: notes,
            }
          : r
      )
    );
    triggerToast('📋 작업자 서류 1차 적격 확인이 완료되었습니다. (감리원 최종 승인으로 이관)');
  };

  // Handle Approve Join Request (Enforces Category-to-Role Mapping)
  const handleApproveJoinRequest = async (requestId: string) => {
    const target = joinRequests.find((r) => r.id === requestId);
    if (!target) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'approve_join_request',
        requestId,
        processedBy: currentUser.name,
      }));
      return;
    } else {
      try {
        const res = await fetch(`/api/chat/join-requests/${requestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            processedBy: currentUser.name,
            userRole: currentUser.userRole,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          triggerToast('⚠️ ' + (errData.error || '승인 권한이 없습니다.'));
          return;
        }
      } catch (err) {
        console.warn('Failed to approve join request:', err);
        triggerToast('⚠️ 서버에 연결할 수 없어 처리하지 못했습니다.');
        return;
      }
    }

    setJoinRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: '승인',
              processedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
              processedBy: currentUser.name,
            }
          : r
      )
    );
    triggerToast('✅ 참가자의 단톡방 입장을 최종 승인하였습니다.');
  };

  // Handle Reject Join Request
  const handleRejectJoinRequest = async (requestId: string, reason: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'reject_join_request',
        requestId,
        rejectReason: reason,
        processedBy: currentUser.name,
      }));
      return;
    } else {
      try {
        const res = await fetch(`/api/chat/join-requests/${requestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reject',
            rejectReason: reason,
            processedBy: currentUser.name,
            userRole: currentUser.userRole,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          triggerToast('⚠️ ' + (errData.error || '반려 권한이 없습니다.'));
          return;
        }
      } catch (err) {
        console.warn('Failed to reject join request:', err);
        triggerToast('⚠️ 서버에 연결할 수 없어 처리하지 못했습니다.');
        return;
      }
    }

    setJoinRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: '반려',
              processedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
              processedBy: currentUser.name,
              rejectReason: reason,
            }
          : r
      )
    );
    triggerToast('🚫 참가자 입장 신청을 반려하였습니다.');
  };

  // Handle Submit New Join Request
  const handleSubmitNewJoinRequest = async (data: Omit<ChatJoinRequest, 'id' | 'requestedAt' | 'status'>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'submit_join_request',
        request: data,
      }));
    } else {
      await fetch('/api/chat/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }
    triggerToast(`📋 [신청 완료] '${data.name}' 님의 단톡방 입장 승인 신청서가 접수되었습니다.`);
  };

  // Handle Supervision Inspection Judgment (Enforces Supervisor Role)
  const handleJudgeInspection = (
    inspectionId: string,
    judgment: '적합승인' | '조건부승인' | '부적합',
    notes: string,
    broadcastToChat: boolean
  ) => {
    if (currentUser.userRole !== 'supervisor') {
      triggerToast('⚠️ 공정 단계 승인은 법정 감리원의 고유 업무입니다. (행정실/교육청은 결과 열람 권한)');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'judge_inspection',
        inspectionId,
        status: judgment,
        notes,
        broadcastToChat,
      }));
      triggerToast(`⚖️ [감리 판정] '${judgment}' 판정을 전송했습니다.`);
      return;
    } else {
      fetch(`/api/supervision/inspections/${inspectionId}/judge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: judgment,
          notes,
          broadcastToChat,
          inspectorName: currentUser.name,
          userRole: currentUser.userRole,
        }),
      });
    }

    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    setInspections((prev) =>
      prev.map((item) => {
        if (item.id === inspectionId) {
          return {
            ...item,
            status: judgment,
            judgmentNotes: notes,
            judgedAt: timeStr,
            inspectorName: currentUser.name,
            inspectorRole: currentUser.role,
          };
        }
        return item;
      })
    );

    triggerToast(`⚖️ [감리 판정] '${judgment}' 처리가 완료되었습니다.`);
  };

  // Handle Emergency Stop by Supervisor
  const handleIssueEmergencyStop = (reason: string) => {
    if (currentUser.userRole !== 'supervisor') {
      triggerToast('⚠️ 긴급 작업중지권은 석면안전관리법상 감리원의 직권으로만 발동할 수 있습니다.');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'issue_emergency_stop',
        reason,
      }));
    }

    triggerToast('🚨 [비상 경보] 감리원 긴급 작업중지 명령이 단톡방에 발령되었습니다.');
    handleSendMessage({
      text: `🚨🚨🚨 [감리원 긴급 작업중지 명령 - 전 구역 공사 즉시 중단]\n\n「석면안전관리법 제30조」 및 지침에 의거하여 특급 감리원의 직권으로 전 구역 작업을 즉각 중단합니다.\n\n■ 중지 사유: ${reason}\n■ 긴급 지시사항:\n1. 전 작업자는 즉시 작업을 중단하고 공구 거치 후 위생설비를 통하여 퇴실하십시오.\n2. 음압기 가동 및 밀폐 비닐 차압 상태를 외부에서 유지 모니터링하십시오.\n3. 늘푸른고 행정실 및 교육청 감독관 현장 안전 대책반 즉시 소집.`,
      type: 'alert',
      metadata: {
        zone: '본관 1층 전 구역',
        status: '감리작업중지명령발령',
      },
    });
  };

  // Handle Add Concentration Point
  const handleAddConcentration = async (pointData: Omit<ConcentrationPoint, 'id'>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'add_concentration',
        ...pointData,
      }));
    } else {
      try {
        const res = await fetch('/api/monitoring/concentrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pointData),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.concentrations) setConcentrations(data.concentrations);
        }
      } catch (err) {
        console.warn('Failed to add concentration:', err);
      }
    }
    triggerToast(`📊 [비산농도 등록] ${pointData.zone} 실측값 ${pointData.value.toFixed(4)}개/cm³ 기록 완료`);
  };

  // Handle Trigger Emergency Alert when threshold exceeded
  const handleTriggerEmergencyAlert = (reason: string, value: number, zone: string) => {
    handleSendMessage({
      text: `🚨🚨🚨 [비산농도 법정 기준치(0.010 개/cm³) 초과 긴급 공지]\n\n■ 실측치: ${value.toFixed(4)} 개/cm³ (기준치 대비 ${((value / 0.010) * 100).toFixed(0)}%)\n■ 발생 구역: ${zone}\n■ 사유: ${reason}\n■ 조치사항: 전 구역 작업 일시 중단 및 감리원·현장대리인 비상 점검 실시`,
      type: 'alert',
      metadata: {
        zone,
        status: '비산농도초과',
        pressure: '긴급차압점검요망',
      },
    });
    triggerToast('🚨 [비상 경보] 비산농도 초과 경보가 단톡방에 공지되었습니다.');
  };

  const stepList: ProcessStep[] = processSteps.length > 0 ? processSteps : DEFAULT_PROCESS_STEPS;
  const pendingApprovalCount = joinRequests.filter((r) => r.status === '대기').length;
  const pendingSupervisionCount = inspections.filter((i) => i.status === '대기').length;

  const currentRoom =
    rooms.find((r) => r.id === currentRoomId) ||
    rooms[0] || {
      id: 'room-main',
      name: '늘푸른고 석면해체 종합 안전단톡방',
      description: '석면 해체 현장 실시간 소통방',
      category: '현장종합' as const,
      createdAt: new Date().toISOString(),
      createdBy: '늘푸른고 행정실',
      memberCount: 12,
    };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[99999] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-top duration-200 max-w-sm">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <p className="text-xs font-medium leading-relaxed text-slate-100">{toastMessage}</p>
        </div>
      )}

      {/* Universal Top Bar Contract: Zone 1 (Brand) - Zone 2 (Nav links) - Zone 3 (Actions) */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap">
              늘푸른고 석면안전 종합관리
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <button
              onClick={() => setActiveTab('monitoring')}
              className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'monitoring'
                  ? 'bg-slate-800 text-white font-semibold shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>비산농도 실시간 모니터링</span>
            </button>
            <button
              onClick={() => setActiveTab('process')}
              className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'process'
                  ? 'bg-slate-800 text-white font-semibold shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>공정 단계 검사 현황</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-slate-800 text-white font-semibold shadow-inner'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4 text-amber-400" />
              <span>층별 석면도면</span>
            </button>
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Role Switcher Pill */}
            <div className="relative">
              <button
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: currentUser.avatarColor }}
                />
                <span className="truncate max-w-[100px] sm:max-w-[130px]">
                  {currentUser.name} ({currentUser.userRole === 'school_admin' ? '행정실장' : currentUser.userRole === 'supervisor' ? '감리원' : currentUser.userRole === 'contractor' ? '현장대리인' : '일반'})
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {isRoleMenuOpen && (
                <div className="absolute right-0 top-10 z-50 w-64 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 p-2 animate-in fade-in duration-150">
                  <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    참여 역할(페르소나) 변경
                  </div>
                  <div className="space-y-1 my-1">
                    {ROLE_PRESETS.map((preset) => (
                      <button
                        key={preset.role}
                        onClick={() => {
                          const matchedUser: ChatUser = {
                            id: 'user-' + preset.role,
                            name: preset.name,
                            role: preset.title,
                            company: preset.company,
                            avatarColor: preset.avatarColor,
                            userRole: preset.role,
                            authVerified: true,
                          };
                          handleChangeUser(matchedUser, preset.code);
                          setIsRoleMenuOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                          currentUser.userRole === preset.role
                            ? 'bg-indigo-50 text-indigo-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: preset.avatarColor }}
                          />
                          <div>
                            <span className="block font-semibold">{preset.name}</span>
                            <span className="text-[10px] text-slate-400 block">{preset.title}</span>
                          </div>
                        </div>
                        {currentUser.userRole === preset.role && (
                          <span className="text-[10px] text-indigo-600 font-bold">선택됨</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Field Chat Launcher Button in Header */}
            <button
              onClick={() => {
                setIsOpen(!isOpen);
                setUnreadCount(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
                isOpen
                  ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">현장 안전 단톡방</span>
              <span className="sm:hidden">단톡방</span>
              {unreadCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center border-t border-slate-800 px-3 py-1.5 bg-slate-900/90 text-xs overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap cursor-pointer ${
              activeTab === 'monitoring'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            비산농도 모니터링
          </button>
          <button
            onClick={() => setActiveTab('process')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap cursor-pointer ${
              activeTab === 'process'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            공정 단계 검사
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap cursor-pointer ${
              activeTab === 'map'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            층별 석면도면
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab 1: Concentration Monitoring Dashboard */}
        {activeTab === 'monitoring' && (
          <ConcentrationDashboard
            concentrations={concentrations}
            currentUser={currentUser}
            onAddConcentration={handleAddConcentration}
            onTriggerEmergencyAlert={handleTriggerEmergencyAlert}
            onOpenChat={() => {
              setIsOpen(true);
              setUnreadCount(0);
            }}
          />
        )}

        {/* Tab 2: Process Steps & Supervision Inspections */}
        {activeTab === 'process' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  학교 석면 해체·제거 법정 공정 및 감리 검사 현황
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  석면안전관리법 및 교육부 가이드라인에 따른 사전준비, 밀폐보양, 습식해체, 잔재물검사 및 최종 공기질 승인 프로세스
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsSupervisionModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>감리원 공식 판정 ({inspections.filter((i) => i.status === '대기').length}건 대기)</span>
                </button>
              </div>
            </div>

            {/* Supervision Inspection Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inspections.map((insp) => (
                <div
                  key={insp.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        제{insp.stageNumber}단계 · {insp.stage}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          insp.status === '적합승인'
                            ? 'bg-emerald-100 text-emerald-800'
                            : insp.status === '조건부승인'
                            ? 'bg-amber-100 text-amber-800'
                            : insp.status === '부적합'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {insp.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">{insp.title}</h3>
                    <p className="text-xs text-slate-500 mb-3">{insp.zone}</p>
                    {insp.measuredValue && (
                      <div className="p-2 bg-slate-50 rounded-lg text-xs font-mono text-slate-700 mb-2">
                        실측: {insp.measuredValue}
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>감리원: {insp.inspectorName}</span>
                    <span>{insp.judgedAt ? `승인시각: ${insp.judgedAt}` : '검사 대기중'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Process Step List */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900">전체 {stepList.length}단계 표준 프로세스 (비석면 선행 철거 포함)</h3>
              <div className="divide-y divide-slate-100 text-xs">
                {stepList.map((step) => (
                  <div key={step.step} className="py-3 flex items-start gap-4 hover:bg-slate-50 px-2 rounded-lg transition-colors">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold font-mono flex items-center justify-center shrink-0 text-xs">
                      {step.step}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">{step.title}</span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            step.category === '선행철거' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {step.category}
                        </span>
                        {step.responsible && <span className="text-[10px] text-slate-400">담당: {step.responsible}</span>}
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{step.description}</p>
                      {step.checklist && step.checklist.length > 0 && (
                        <ul className="mt-2 space-y-1 text-[11px] text-slate-600 list-disc pl-4">
                          {step.checklist.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Floorplan Map Blueprint Viewer */}
        {activeTab === 'map' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">늘푸른고 층별 석면 분포도 및 공사도면</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  본관 1층~5층 석면 함유 건축자재 위치 및 실시간 공사 차단 구역 도면
                </p>
              </div>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                {['1층', '2층', '3층', '4층', '5층'].map((fl) => (
                  <button
                    key={fl}
                    onClick={() => setSelectedFloor(fl)}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      selectedFloor === fl
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {fl}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl p-6 text-white text-center min-h-[400px] flex flex-col items-center justify-center border border-slate-800">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-4">
                <Layers className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-1">{selectedFloor} 석면 해체 관리 구역도</h3>
              <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
                현재 {selectedFloor} 급식실 및 복도 밀폐 비닐 보양(0.15mm) 및 음압기 가동 구역으로, 비산농도 센서 3개 지점 집중 포집 중입니다.
              </p>
              {maps[selectedFloor] ? (
                <img
                  src={maps[selectedFloor]}
                  alt={`${selectedFloor} 석면지도`}
                  className="max-h-[380px] max-w-full rounded-lg border border-slate-700 shadow-md object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 text-xs text-slate-300">
                  도면 파일 로드 완료: {selectedFloor} 석면지도 (무석면 텍스 교체 공정 반영)
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom-Right Chat Launcher Button (when window is closed) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-[9985] flex flex-col items-end gap-2">
          {pendingSupervisionCount > 0 && (
            <button
              onClick={() => {
                setIsOpen(true);
                setIsSupervisionModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 animate-pulse cursor-pointer"
            >
              <span>⚖️ 감리판정 대기 {pendingSupervisionCount}건</span>
            </button>
          )}

          {pendingApprovalCount > 0 && (
            <button
              onClick={() => {
                setIsOpen(true);
                setIsApprovalModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-1.5 animate-pulse cursor-pointer"
            >
              <span>🛡️ 입장승인 대기 {pendingApprovalCount}건</span>
            </button>
          )}

          {/* Main Launcher Pill */}
          <button
            onClick={() => {
              setIsOpen(true);
              setUnreadCount(0);
            }}
            className="group relative flex items-center gap-3 px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-2xl hover:shadow-indigo-500/20 transition-all duration-200 border border-slate-700 cursor-pointer"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md group-hover:scale-105 transition-transform">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                  isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </div>

            <div className="text-left">
              <div className="text-xs font-bold flex items-center gap-1.5 text-white">
                <span>현장 안전 단톡방</span>
                <span className="text-[10px] text-emerald-400 font-bold">· LIVE</span>
              </div>
              <p className="text-[11px] text-slate-400 max-w-[150px] truncate">
                {currentRoom.name}
              </p>
            </div>

            {unreadCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shadow-md animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Active Field Chat Window */}
      {isOpen && (
        <FieldChatWindow
          rooms={rooms}
          currentRoom={currentRoom}
          messages={messages}
          currentUser={currentUser}
          onlineCount={onlineCount}
          isConnected={isConnected}
          onSelectRoom={handleSelectRoom}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          onOpenApprovalModal={() => setIsApprovalModalOpen(true)}
          pendingApprovalCount={pendingApprovalCount}
          onOpenSupervisionModal={() => setIsSupervisionModalOpen(true)}
          pendingSupervisionCount={pendingSupervisionCount}
          onSendMessage={handleSendMessage}
          onChangeUser={handleChangeUser}
          onClose={() => setIsOpen(false)}
        />
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        currentUser={currentUser}
        onCreateRoom={handleCreateRoom}
      />

      {/* Join Request Approval Management Modal */}
      <JoinApprovalModal
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        requests={joinRequests}
        onVerify={handleVerifyJoinRequest}
        onApprove={handleApproveJoinRequest}
        onReject={handleRejectJoinRequest}
        onSubmitNewRequest={handleSubmitNewJoinRequest}
        currentUser={currentUser}
        onChangeUser={handleChangeUser}
        roomId={currentRoom.id}
        roomName={currentRoom.name}
      />

      {/* Supervision Admin Judgment Modal */}
      <SupervisionAdminModal
        isOpen={isSupervisionModalOpen}
        onClose={() => setIsSupervisionModalOpen(false)}
        currentUser={currentUser}
        onChangeUser={handleChangeUser}
        inspections={inspections}
        onJudgeInspection={handleJudgeInspection}
        onIssueEmergencyStop={handleIssueEmergencyStop}
      />
    </div>
  );
}

