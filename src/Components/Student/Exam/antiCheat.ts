import { API_BASE_URL } from '../../../config/env';

export type AntiCheatEventType =
  | 'PageHidden'
  | 'PageVisible'
  | 'WindowBlur'
  | 'WindowFocus'
  | 'FullscreenExited'
  | 'FullscreenEntered'
  | 'Copy'
  | 'Paste'
  | 'Reload'
  | 'Offline'
  | 'Online'
  | 'AttemptOpenedInAnotherTab'
  | 'AttemptResumed';

type AntiCheatMetadataValue = string | number | boolean | null | undefined;

export interface AntiCheatEventPayload {
  occurredAt: string;
  eventType: AntiCheatEventType;
  sessionFingerprint?: string;
  userAgent?: string;
  metadata?: string;
}

export interface AntiCheatUiEvent {
  id: string;
  occurredAt: string;
  eventType: AntiCheatEventType;
  label: string;
  details: string;
}

const EVENT_LABELS: Record<AntiCheatEventType, string> = {
  PageHidden: 'Ẩn bài thi',
  PageVisible: 'Quay lại bài thi',
  WindowBlur: 'Chuyển cửa sổ',
  WindowFocus: 'Quay lại cửa sổ',
  FullscreenExited: 'Thoát toàn màn hình',
  FullscreenEntered: 'Vào toàn màn hình',
  Copy: 'Sao chép nội dung',
  Paste: 'Dán nội dung',
  Reload: 'Tải lại trang',
  Offline: 'Mất kết nối mạng',
  Online: 'Khôi phục kết nối mạng',
  AttemptOpenedInAnotherTab: 'Mở bài ở tab khác',
  AttemptResumed: 'Tiếp tục phiên làm bài',
};

const sanitizeMetadata = (metadata?: Record<string, AntiCheatMetadataValue>) => {
  if (!metadata) return undefined;

  const entries = Object.entries(metadata).filter(([, value]) =>
    ['string', 'number', 'boolean'].includes(typeof value) || value === null
  ) as Array<[string, string | number | boolean | null]>;

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const serializeMetadata = (metadata?: Record<string, AntiCheatMetadataValue>) => {
  const sanitized = sanitizeMetadata(metadata);
  return sanitized ? JSON.stringify(sanitized) : undefined;
};

export const getSessionFingerprint = () => {
  if (typeof window === 'undefined') return undefined;

  const screenSize = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  return [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    navigator.hardwareConcurrency ?? 'na',
    screenSize,
  ].join('|');
};

export const getAntiCheatEventLabel = (eventType: AntiCheatEventType) => EVENT_LABELS[eventType];

export const buildAntiCheatEventPayload = (
  eventType: AntiCheatEventType,
  metadata?: Record<string, AntiCheatMetadataValue>,
  occurredAt = new Date().toISOString()
): AntiCheatEventPayload => ({
  occurredAt,
  eventType,
  sessionFingerprint: getSessionFingerprint(),
  userAgent: typeof navigator === 'undefined' ? undefined : navigator.userAgent,
  metadata: serializeMetadata(metadata),
});

export const createAntiCheatUiEvent = (
  eventType: AntiCheatEventType,
  details: string,
  occurredAt = new Date().toISOString()
): AntiCheatUiEvent => ({
  id: `${eventType}-${occurredAt}`,
  occurredAt,
  eventType,
  label: getAntiCheatEventLabel(eventType),
  details,
});

export const postAntiCheatEvent = async (
  studentExamId: string,
  payload: AntiCheatEventPayload,
  options: RequestInit = {}
) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/student-exams/${studentExamId}/anti-cheat/events`, {
    ...options,
    method: 'POST',
    keepalive: options.keepalive,
    headers: {
      accept: '*/*',
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
      ...(options.headers || {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }
};
