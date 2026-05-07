const HAS_TIMEZONE_SUFFIX = /(Z|[+-]\d{2}:\d{2})$/i;

export const parseApiDateTime = (value?: string | null): Date | null => {
  if (!value) return null;

  const normalizedValue = HAS_TIMEZONE_SUFFIX.test(value) ? value : `${value}Z`;
  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export const formatVietnamDateTime = (
  value?: string | null,
  options?: Intl.DateTimeFormatOptions
) => {
  const parsedDate = parseApiDateTime(value);
  if (!parsedDate) return '--';

  return parsedDate.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
};

export const resolveAttemptDeadlineUtc = (
  startedAt?: string | null,
  durationMinutes?: number,
  attemptDeadlineUtc?: string | null
) => {
  if (attemptDeadlineUtc) return attemptDeadlineUtc;

  const startedAtDate = parseApiDateTime(startedAt);
  if (startedAtDate && durationMinutes && durationMinutes > 0) {
    const fallbackDeadline = new Date(startedAtDate.getTime() + durationMinutes * 60 * 1000);
    return fallbackDeadline.toISOString();
  }

  return null;
};