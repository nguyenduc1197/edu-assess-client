import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AntiCheatEventPayload,
  AntiCheatEventType,
  AntiCheatUiEvent,
  buildAntiCheatEventPayload,
  createAntiCheatUiEvent,
  postAntiCheatEvent,
} from './antiCheat';

interface PendingAntiCheatEvent {
  payload: AntiCheatEventPayload;
}

interface UseAntiCheatMonitoringOptions {
  enabled: boolean;
  studentExamId?: string | null;
  maxVisibleEvents?: number;
}

const DEDUPLICATION_WINDOW_MS = 1500;

export const useAntiCheatMonitoring = ({
  enabled,
  studentExamId,
  maxVisibleEvents = 3,
}: UseAntiCheatMonitoringOptions) => {
  const [recentEvents, setRecentEvents] = useState<AntiCheatUiEvent[]>([]);
  const [totalEventCount, setTotalEventCount] = useState(0);
  const [syncErrorCount, setSyncErrorCount] = useState(0);
  const recentTimestampsRef = useRef<Partial<Record<AntiCheatEventType, number>>>({});
  const pendingEventsRef = useRef<PendingAntiCheatEvent[]>([]);
  const sendQueueRef = useRef(Promise.resolve());

  const enqueueSend = useCallback((targetStudentExamId: string, payload: AntiCheatEventPayload) => {
    sendQueueRef.current = sendQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await postAntiCheatEvent(targetStudentExamId, payload);
          setSyncErrorCount(0);
        } catch {
          setSyncErrorCount((current) => current + 1);
        }
      });
  }, []);

  const trackEvent = useCallback(
    (
      eventType: AntiCheatEventType,
      details: string,
      metadata?: Record<string, string | number | boolean | null | undefined>
    ) => {
      if (!enabled) return;

      const now = Date.now();
      const previousTimestamp = recentTimestampsRef.current[eventType];
      if (previousTimestamp && now - previousTimestamp < DEDUPLICATION_WINDOW_MS) {
        return;
      }
      recentTimestampsRef.current[eventType] = now;

      const occurredAt = new Date(now).toISOString();
      const uiEvent = createAntiCheatUiEvent(eventType, details, occurredAt);
      const payload = buildAntiCheatEventPayload(eventType, details, metadata, occurredAt);

      setRecentEvents((current) => [uiEvent, ...current].slice(0, maxVisibleEvents));
      setTotalEventCount((current) => current + 1);

      if (studentExamId) {
        enqueueSend(studentExamId, payload);
        return;
      }

      pendingEventsRef.current.push({ payload });
    },
    [enabled, enqueueSend, maxVisibleEvents, studentExamId]
  );

  useEffect(() => {
    if (!studentExamId || pendingEventsRef.current.length === 0) return;

    const pendingEvents = [...pendingEventsRef.current];
    pendingEventsRef.current = [];
    pendingEvents.forEach(({ payload }) => enqueueSend(studentExamId, payload));
  }, [enqueueSend, studentExamId]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) return;
      trackEvent('VisibilityHidden', 'Rời khỏi tab hoặc thu nhỏ cửa sổ bài thi.', {
        visibilityState: document.visibilityState,
        page: window.location.pathname,
      });
    };

    const handleWindowBlur = () => {
      trackEvent('WindowBlur', 'Chuyển sang cửa sổ khác trong lúc làm bài.', {
        page: window.location.pathname,
      });
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) return;
      trackEvent('FullscreenExited', 'Thoát khỏi chế độ toàn màn hình.', {
        fullscreenEnabled: document.fullscreenEnabled,
        page: window.location.pathname,
      });
    };

    const handleCopy = () => {
      trackEvent('CopyAttempt', 'Cố gắng sao chép nội dung bài thi.', {
        page: window.location.pathname,
      });
    };

    const handleCut = () => {
      trackEvent('CutAttempt', 'Cố gắng cắt nội dung bài thi.', {
        page: window.location.pathname,
      });
    };

    const handlePaste = () => {
      trackEvent('PasteAttempt', 'Cố gắng dán nội dung trong bài thi.', {
        page: window.location.pathname,
      });
    };

    const handleContextMenu = () => {
      trackEvent('ContextMenuAttempt', 'Mở menu chuột phải trong lúc làm bài.', {
        page: window.location.pathname,
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [enabled, trackEvent]);

  return {
    isMonitoring: enabled && !!studentExamId,
    recentEvents,
    totalEventCount,
    syncErrorCount,
  };
};
