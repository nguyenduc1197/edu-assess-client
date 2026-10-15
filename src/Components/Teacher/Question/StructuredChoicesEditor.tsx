import React from 'react';
import { Plus, X } from 'lucide-react';
import { Choice, QuestionFormat } from '../../../types';
import {
  choiceLabelFor,
  parseBlankNumbers,
  STRUCTURED_MAX_CHOICES,
  STRUCTURED_MAX_SLOTS,
} from '../../../utils/structuredQuestion';

interface StructuredChoicesEditorProps {
  format: Extract<QuestionFormat, 'FillInBlank' | 'Matching'>;
  /** Fill-in-the-blank passage (with [[n]] blanks); used to count blanks. */
  content: string;
  matchingPrompts: string[];
  choices: Choice[];
  onChange: (patch: { matchingPrompts?: string[]; choices?: Choice[] }) => void;
  labelPrefix?: string;
  inputClassName?: string;
}

const defaultInputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

/**
 * Teacher editor for fill-in-the-blank (word bank incl. distractors) and matching (column A + column B incl. extras).
 * Each word / column B item is assigned to at most one blank / column A item; unassigned ones are distractors.
 */
const StructuredChoicesEditor: React.FC<StructuredChoicesEditorProps> = ({
  format,
  content,
  matchingPrompts,
  choices,
  onChange,
  labelPrefix = '',
  inputClassName = defaultInputClass,
}) => {
  const prefix = labelPrefix ? `${labelPrefix} ` : '';
  const isFill = format === 'FillInBlank';
  const slotCount = isFill ? parseBlankNumbers(content).length : matchingPrompts.length;
  const slotName = isFill ? 'chỗ trống' : 'vế A';

  const relabel = (list: Choice[]) => list.map((choice, index) => ({ ...choice, optionLabel: choiceLabelFor(index) }));

  const setChoice = (index: number, patch: Partial<Choice>) =>
    onChange({ choices: choices.map((choice, i) => (i === index ? { ...choice, ...patch } : choice)) });

  /** A slot keeps a single correct choice: assigning it elsewhere frees the previous one. */
  const assignSlot = (index: number, slot: number | null) =>
    onChange({
      choices: choices.map((choice, i) => {
        if (i === index) return { ...choice, correctSlot: slot, isCorrect: slot !== null };
        if (slot !== null && choice.correctSlot === slot) return { ...choice, correctSlot: null, isCorrect: false };
        return choice;
      }),
    });

  const removePrompt = (promptIndex: number) => {
    const removedSlot = promptIndex + 1;
    onChange({
      matchingPrompts: matchingPrompts.filter((_, i) => i !== promptIndex),
      choices: choices.map((choice) => {
        if (choice.correctSlot == null) return choice;
        if (choice.correctSlot === removedSlot) return { ...choice, correctSlot: null, isCorrect: false };
        return choice.correctSlot > removedSlot ? { ...choice, correctSlot: choice.correctSlot - 1 } : choice;
      }),
    });
  };

  return (
    <div className="space-y-3" data-testid="structured-editor">
      {isFill ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Đánh dấu chỗ trống trong đoạn văn bằng [[1]], [[2]], ... Hiện có {slotCount} chỗ trống.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Cột A</p>
          {matchingPrompts.map((prompt, promptIndex) => (
            <div key={promptIndex} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-sm font-bold text-primary">{promptIndex + 1}.</span>
              <input
                aria-label={`${prefix}cột A vế ${promptIndex + 1}`}
                value={prompt}
                onChange={(e) => onChange({ matchingPrompts: matchingPrompts.map((p, i) => (i === promptIndex ? e.target.value : p)) })}
                className={inputClassName}
              />
              {matchingPrompts.length > 2 && (
                <button
                  type="button"
                  onClick={() => removePrompt(promptIndex)}
                  className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  aria-label={`${prefix}xóa vế A ${promptIndex + 1}`}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {matchingPrompts.length < STRUCTURED_MAX_SLOTS && (
            <button
              type="button"
              onClick={() => onChange({ matchingPrompts: [...matchingPrompts, ''] })}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <Plus size={14} /> Thêm vế cột A
            </button>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          {isFill ? 'Ngân hàng từ (gồm cả từ nhiễu)' : 'Cột B (có thể có ý dư)'} – chọn {slotName} mà mỗi mục là đáp án đúng
        </p>
        {choices.map((choice, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-sm font-bold text-primary">{choiceLabelFor(index).toLowerCase()}.</span>
            <input
              aria-label={`${prefix}${isFill ? 'từ' : 'cột B mục'} ${choiceLabelFor(index).toLowerCase()}`}
              value={choice.content}
              onChange={(e) => setChoice(index, { content: e.target.value })}
              className={inputClassName}
            />
            <select
              aria-label={`${prefix}đáp án cho ${isFill ? 'từ' : 'mục'} ${choiceLabelFor(index).toLowerCase()}`}
              value={choice.correctSlot ?? ''}
              onChange={(e) => assignSlot(index, e.target.value ? Number(e.target.value) : null)}
              className={`w-36 shrink-0 ${inputClassName}`}
            >
              <option value="">{isFill ? 'Từ nhiễu' : 'Ý dư'}</option>
              {Array.from({ length: slotCount }, (_, i) => i + 1).map((slot) => (
                <option key={slot} value={slot}>
                  {isFill ? `Chỗ trống [[${slot}]]` : `Ghép với ${slot}`}
                </option>
              ))}
            </select>
            {choices.length > 1 && (
              <button
                type="button"
                onClick={() => onChange({ choices: relabel(choices.filter((_, i) => i !== index)) })}
                className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                aria-label={`${prefix}xóa mục ${choiceLabelFor(index).toLowerCase()}`}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {choices.length < STRUCTURED_MAX_CHOICES && (
          <button
            type="button"
            onClick={() =>
              onChange({ choices: relabel([...choices, { optionLabel: '', content: '', isCorrect: false, correctSlot: null }]) })
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            <Plus size={14} /> {isFill ? 'Thêm từ' : 'Thêm mục cột B'}
          </button>
        )}
      </div>
    </div>
  );
};

export default StructuredChoicesEditor;
