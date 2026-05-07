import {
  buildAntiCheatEventPayload,
  createAntiCheatUiEvent,
  getAntiCheatEventLabel,
} from './antiCheat';

describe('antiCheat helpers', () => {
  it('builds a backend payload with compatible anti-cheat keys', () => {
    const occurredAt = '2026-05-05T00:00:00.000Z';
    const payload = buildAntiCheatEventPayload(
      'PageHidden',
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
      eventType: 'PageHidden',
      sessionFingerprint: expect.any(String),
      userAgent: expect.any(String),
      metadata: JSON.stringify({
        visibilityState: 'hidden',
        count: 2,
        retryable: true,
      }),
    });
  });

  it('creates readable event labels for the UI', () => {
    const occurredAt = '2026-05-05T00:00:00.000Z';
    const uiEvent = createAntiCheatUiEvent(
      'Paste',
      'Cố gắng dán nội dung trong bài thi.',
      occurredAt
    );

    expect(getAntiCheatEventLabel('Paste')).toBe('Dán nội dung');
    expect(uiEvent).toEqual({
      id: `Paste-${occurredAt}`,
      occurredAt,
      eventType: 'Paste',
      label: 'Dán nội dung',
      details: 'Cố gắng dán nội dung trong bài thi.',
    });
  });
});
