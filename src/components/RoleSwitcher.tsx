import { ROLE_LABELS, ROLE_PRESETS, type ChatUser, type UserRole } from '../types/chat';

interface Props {
  currentUser: ChatUser;
  onChangeUser: (user: ChatUser, code?: string) => void;
  /** 이 기능에 필요한 역할. 지정하면 해당 역할 버튼을 강조한다. */
  needed?: UserRole[];
}

export function presetToUser(preset: (typeof ROLE_PRESETS)[number]): ChatUser {
  return {
    id: 'user-' + preset.role,
    name: preset.name,
    role: preset.title,
    company: preset.company,
    avatarColor: preset.avatarColor,
    userRole: preset.role,
    authVerified: true,
  };
}

export function RoleSwitcher({ currentUser, onChangeUser, needed }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-slate-500">역할 전환:</span>
      {ROLE_PRESETS.map((preset) => {
        const active = currentUser.userRole === preset.role;
        const highlight = needed?.includes(preset.role);
        return (
          <button
            key={preset.role}
            type="button"
            onClick={() => onChangeUser(presetToUser(preset), preset.code || undefined)}
            className={`px-2 py-1 rounded-md font-semibold border transition-colors cursor-pointer ${
              active
                ? 'bg-indigo-600 text-white border-indigo-600'
                : highlight
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {preset.name} · {ROLE_LABELS[preset.role]}
          </button>
        );
      })}
    </div>
  );
}
