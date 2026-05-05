import {
  buildAntiCheatEventPayload,
  createAntiCheatUiEvent,
  getAntiCheatEventLabel,
} from './antiCheat';

describe('antiCheat helpers', () => {
  it('builds a backend payload with compatible anti-cheat keys', () => {
    const occurredAt = '2026-05-05T00:00:00.000Z';
    const payload = buildAntiCheatEventPayload(
      'VisibilityHidden',
      'Rời khỏi tab hoặc thu nhỏ cửa sổ bài thi.',
      {
        visibilityState: 'hidden',
        count: 2,
        retryable: true,
        ignored: undefined,
      },
      occurredAt
    );

    expect(payload).toEqual({
      occurredAt,
      eventType: 'VisibilityHidden',
      details: 'Rời khỏi tab hoặc thu nhỏ cửa sổ bài thi.',
      metadata: {
        visibilityState: 'hidden',
        count: 2,
        retryable: true,
      },
    });
  });

  it('creates readable event labels for the UI', () => {
    const occurredAt = '2026-05-05T00:00:00.000Z';
    const uiEvent = createAntiCheatUiEvent(
      'PasteAttempt',
      'Cố gắng dán nội dung trong bài thi.',
      occurredAt
    );

    expect(getAntiCheatEventLabel('PasteAttempt')).toBe('Dán nội dung');
    expect(uiEvent).toEqual({
      id: `PasteAttempt-${occurredAt}`,
      occurredAt,
      eventType: 'PasteAttempt',
      label: 'Dán nội dung',
      details: 'Cố gắng dán nội dung trong bài thi.',
    });
  });
});
