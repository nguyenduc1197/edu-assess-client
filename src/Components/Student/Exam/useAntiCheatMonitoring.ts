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
  options?: RequestInit;
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

  const enqueueSend = useCallback((
    targetStudentExamId: string,
    payload: AntiCheatEventPayload,
    options?: RequestInit
  ) => {
    sendQueueRef.current = sendQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await postAntiCheatEvent(targetStudentExamId, payload, options);
          setSyncErrorCount(0);
        } catch {
          setSyncErrorCount((current) => current + 1);
        }
      });
  }, []);

  const trackEvent = useCallback(
      (
        eventType: AntiCheatEventType,
        uiDetails: string,
        metadata?: Record<string, string | number | boolean | null | undefined>,
        options?: RequestInit
      ) => {
        if (!enabled) return;

        const now = Date.now();
      const previousTimestamp = recentTimestampsRef.current[eventType];
      if (previousTimestamp && now - previousTimestamp < DEDUPLICATION_WINDOW_MS) {
        return;
      }
      recentTimestampsRef.current[eventType] = now;

        const occurredAt = new Date(now).toISOString();
        const uiEvent = createAntiCheatUiEvent(eventType, uiDetails, occurredAt);
        const payload = buildAntiCheatEventPayload(eventType, metadata, occurredAt);

        setRecentEvents((current) => [uiEvent, ...current].slice(0, maxVisibleEvents));
        setTotalEventCount((current) => current + 1);

        if (studentExamId) {
          enqueueSend(studentExamId, payload, options);
          return;
        }

        pendingEventsRef.current.push({ payload, options });
      },
      [enabled, enqueueSend, maxVisibleEvents, studentExamId]
    );

  const flushPendingEvents = useCallback(async (targetStudentExamId?: string | null) => {
    const resolvedStudentExamId = targetStudentExamId || studentExamId;
    if (!resolvedStudentExamId) return;

    const pendingEvents = [...pendingEventsRef.current];
    pendingEventsRef.current = [];
    pendingEvents.forEach(({ payload, options }) =>
      enqueueSend(resolvedStudentExamId, payload, options)
    );
    await sendQueueRef.current.catch(() => undefined);
  }, [enqueueSend, studentExamId]);

  const waitForPendingSends = useCallback(async () => {
    await sendQueueRef.current.catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!studentExamId || pendingEventsRef.current.length === 0) return;

    flushPendingEvents(studentExamId);
  }, [flushPendingEvents, studentExamId]);

  useEffect(() => {
    if (!enabled) return;

    const navigationEntry = performance
      .getEntriesByType('navigation')
      .find((entry): entry is PerformanceNavigationTiming => entry instanceof PerformanceNavigationTiming);

    if (navigationEntry?.type === 'reload') {
      trackEvent('Reload', 'Trang làm bài vừa được tải lại.', {
        page: window.location.pathname,
      });
    }

    const handleVisibilityChange = () => {
      trackEvent(
        document.hidden ? 'PageHidden' : 'PageVisible',
        document.hidden
          ? 'Rời khỏi tab hoặc thu nhỏ cửa sổ bài thi.'
          : 'Quay lại tab bài thi.',
        {
          visibilityState: document.visibilityState,
          page: window.location.pathname,
        }
      );
    };

    const handleWindowBlur = () => {
      trackEvent('WindowBlur', 'Chuyển sang cửa sổ khác trong lúc làm bài.', {
        page: window.location.pathname,
      });
    };

    const handleWindowFocus = () => {
      trackEvent('WindowFocus', 'Quay lại cửa sổ làm bài.', {
        page: window.location.pathname,
      });
    };

    const handleFullscreenChange = () => {
      trackEvent(
        document.fullscreenElement ? 'FullscreenEntered' : 'FullscreenExited',
        document.fullscreenElement
          ? 'Vào lại chế độ toàn màn hình.'
          : 'Thoát khỏi chế độ toàn màn hình.',
        {
        fullscreenEnabled: document.fullscreenEnabled,
        page: window.location.pathname,
        }
      );
    };

    const handleCopy = () => {
      trackEvent('Copy', 'Cố gắng sao chép nội dung bài thi.', {
        page: window.location.pathname,
      });
    };

    const handlePaste = () => {
      trackEvent('Paste', 'Cố gắng dán nội dung trong bài thi.', {
        page: window.location.pathname,
      });
    };

    const handleOffline = () => {
      trackEvent('Offline', 'Thiết bị bị mất kết nối mạng.', {
        page: window.location.pathname,
      });
    };

    const handleOnline = () => {
      trackEvent('Online', 'Thiết bị đã kết nối mạng trở lại.', {
        page: window.location.pathname,
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, trackEvent]);

  return {
    isMonitoring: enabled && !!studentExamId,
    recentEvents,
    totalEventCount,
    syncErrorCount,
    flushPendingEvents,
    waitForPendingSends,
  };
};
