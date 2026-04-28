export const competencyScoreToPercent = (
  value?: number | null,
  options?: { clamp?: boolean }
) => {
  if (value === null || value === undefined) return null;

  // Backend returns competency scores on a 0-10 scale.
  const percent = value * 10;
  if (!options?.clamp) return percent;

  return Math.max(0, Math.min(percent, 100));
};

export const formatCompetencyPercent = (
  value?: number | null,
  options?: { fractionDigits?: number; clamp?: boolean; signed?: boolean }
) => {
  const percent = competencyScoreToPercent(value, { clamp: options?.clamp });
  if (percent === null) return '--';

  const formatted = percent.toFixed(options?.fractionDigits ?? 0);
  if (options?.signed && percent > 0) return `+${formatted}%`;
  return `${formatted}%`;
};
