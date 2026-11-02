export const parseApiDateTime = (value?: string | null): Date | null => {
  if (!value) return null;

  const parsedDate = new Date(value);

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
export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** API instant -> "YYYY-MM-DDTHH:mm" in Vietnam time, for <input type="datetime-local">. */
export const toVietnamInputValue = (value?: string | null) => {
  const parsedDate = parseApiDateTime(value);
  if (!parsedDate) return '';

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: VIETNAM_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(parsedDate)
      .map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

/** "YYYY-MM-DDTHH:mm" typed as Vietnam time -> ISO string with explicit offset, regardless of device time zone. */
export const vietnamInputToIso = (value: string) => `${value.length === 16 ? `${value}:00` : value}+07:00`;
