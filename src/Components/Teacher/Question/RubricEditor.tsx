import React from 'react';
import { Plus, X } from 'lucide-react';
import { CompetencyOption } from '../../../types';
import { ESSAY_RUBRIC_MAX_ITEMS, formatPoints, RubricItemInput, rubricTotal } from '../../../utils/essay';

interface RubricEditorProps {
  items: RubricItemInput[];
  onChange: (items: RubricItemInput[]) => void;
  /** Prefix for aria-labels, e.g. "Câu 3". */
  labelPrefix?: string;
  inputClassName?: string;
  /** When given, each ý gets its own competency select ("Theo câu" = same as the question). */
  competencyOptions?: CompetencyOption[];
}

const defaultInputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

/** Essay rubric ("danh sách ý"): content + points per ý; max points = sum. */
const RubricEditor: React.FC<RubricEditorProps> = ({
  items,
  onChange,
  labelPrefix = '',
  inputClassName = defaultInputClass,
  competencyOptions,
}) => {
  const prefix = labelPrefix ? `${labelPrefix} ` : '';
  const update = (index: number, patch: Partial<RubricItemInput>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2" data-testid="rubric-editor">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
        Danh sách ý (đáp án / tiêu chí chấm) – điểm mỗi ý theo bước 0.25; 1 câu trắc nghiệm = 1 điểm
      </p>
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-2 w-10 shrink-0 text-xs font-bold text-primary">Ý {index + 1}</span>
          <textarea
            aria-label={`${prefix}nội dung ý ${index + 1}`}
            value={item.content}
            onChange={(e) => update(index, { content: e.target.value })}
            rows={2}
            className={inputClassName}
          />
          <input
            aria-label={`${prefix}điểm ý ${index + 1}`}
            type="number"
            min={0.25}
            max={40}
            step={0.25}
            value={item.points}
            onChange={(e) => update(index, { points: e.target.value })}
            className={`w-24 shrink-0 ${inputClassName}`}
          />
          {competencyOptions && competencyOptions.length > 0 && (
            <select
              aria-label={`${prefix}năng lực ý ${index + 1}`}
              title="Năng lực của ý"
              value={item.competencyType || ''}
              onChange={(e) => update(index, { competencyType: e.target.value })}
              className={`w-40 shrink-0 ${inputClassName}`}
            >
              <option value="">Năng lực: theo câu</option>
              {competencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="mt-1 rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              aria-label={`${prefix}xóa ý ${index + 1}`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        {items.length < ESSAY_RUBRIC_MAX_ITEMS ? (
          <button
            type="button"
            onClick={() => onChange([...items, { content: '', points: '', competencyType: '' }])}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            <Plus size={14} /> Thêm ý
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200" data-testid="rubric-total">
          Điểm tối đa: {formatPoints(rubricTotal(items))}
        </span>
      </div>
    </div>
  );
};

export default RubricEditor;
