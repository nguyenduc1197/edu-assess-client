import { fetchClient } from '../../../api/fetchClient';

export type AntiCheatEventType =
  | 'VisibilityHidden'
  | 'WindowBlur'
  | 'FullscreenExited'
  | 'CopyAttempt'
  | 'CutAttempt'
  | 'PasteAttempt'
  | 'ContextMenuAttempt';

type AntiCheatMetadataValue = string | number | boolean | null | undefined;

export interface AntiCheatEventPayload {
  occurredAt: string;
  eventType: AntiCheatEventType;
  details: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AntiCheatUiEvent {
  id: string;
  occurredAt: string;
  eventType: AntiCheatEventType;
  label: string;
  details: string;
}

const EVENT_LABELS: Record<AntiCheatEventType, string> = {
  VisibilityHidden: 'Rời khỏi bài thi',
  WindowBlur: 'Chuyển cửa sổ',
  FullscreenExited: 'Thoát toàn màn hình',
  CopyAttempt: 'Sao chép nội dung',
  CutAttempt: 'Cắt nội dung',
  PasteAttempt: 'Dán nội dung',
  ContextMenuAttempt: 'Mở menu chuột phải',
};

const sanitizeMetadata = (metadata?: Record<string, AntiCheatMetadataValue>) => {
  if (!metadata) return undefined;

  const entries = Object.entries(metadata).filter(([, value]) =>
    ['string', 'number', 'boolean'].includes(typeof value) || value === null
  ) as Array<[string, string | number | boolean | null]>;

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export const getAntiCheatEventLabel = (eventType: AntiCheatEventType) => EVENT_LABELS[eventType];

export const buildAntiCheatEventPayload = (
  eventType: AntiCheatEventType,
  details: string,
  metadata?: Record<string, AntiCheatMetadataValue>,
  occurredAt = new Date().toISOString()
): AntiCheatEventPayload => ({
  occurredAt,
  eventType,
  details,
  metadata: sanitizeMetadata(metadata),
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
  payload: AntiCheatEventPayload
) => {
  const response = await fetchClient(`/student-exams/${studentExamId}/anti-cheat/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }
};
