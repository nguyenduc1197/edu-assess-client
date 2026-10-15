import React from 'react';
import { TrueFalseScoringMode } from '../../../types';

export const TRUE_FALSE_SCORING_OPTIONS: { value: TrueFalseScoringMode; label: string; description: string }[] = [
  {
    value: 'Tiered',
    label: 'Theo bậc (mặc định)',
    description: 'Đúng 1 ý = 0,1; 2 ý = 0,25; 3 ý = 0,5; đúng cả nhóm = 1 câu.',
  },
  {
    value: 'PerStatement',
    label: 'Theo tỉ lệ mệnh đề đúng',
    description: 'Điểm nhóm = số mệnh đề đúng ÷ số mệnh đề trong nhóm.',
  },
];

interface TrueFalseScoringModePickerProps {
  value: TrueFalseScoringMode;
  onChange: (value: TrueFalseScoringMode) => void;
}

/** Per-exam choice of how a true/false passage group (weight 1 question) is scored. */
const TrueFalseScoringModePicker: React.FC<TrueFalseScoringModePickerProps> = ({ value, onChange }) => (
  <fieldset className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
    <legend className="px-1 text-sm font-medium text-gray-900 dark:text-gray-100">Cách tính điểm nhóm Đúng/Sai</legend>
    <div className="mt-1 space-y-2">
      {TRUE_FALSE_SCORING_OPTIONS.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="trueFalseScoringMode"
            className="mt-1"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>
            <span className="block text-sm text-gray-900 dark:text-gray-100">{option.label}</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
          </span>
        </label>
      ))}
    </div>
  </fieldset>
);

export default TrueFalseScoringModePicker;
