import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { StructuredAnswerReview } from '../../../types';
import { splitBlankPassage } from '../../../utils/structuredQuestion';

interface StructuredAnswerReviewListProps {
  items: StructuredAnswerReview[];
}

const formatFraction = (value: number) => String(Math.round(value * 100) / 100);

/** Results of fill-in-the-blank / matching answers (submitted attempts): each blank / pair right or wrong. */
const StructuredAnswerReviewList: React.FC<StructuredAnswerReviewListProps> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="structured-answer-review">
      {items.map((item, index) => {
        const isFill = item.questionFormat === 'FillInBlank';
        const slotBySlot = new Map(item.slots.map((slot) => [slot.slot, slot]));
        return (
          <div key={item.questionId} className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                  {isFill ? 'Điền khuyết' : 'Ghép đôi'} {index + 1}:
                </span>{' '}
                {isFill ? 'Điền từ vào chỗ trống' : item.questionContent}
              </p>
              <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Đúng {item.correctCount}/{item.slotCount} · {formatFraction(item.score)} câu
              </span>
            </div>

            {isFill && (
              <p className="whitespace-pre-line text-sm leading-8 text-gray-800 dark:text-gray-200">
                {splitBlankPassage(item.questionContent).map((part, partIndex) => {
                  if (part.kind === 'text') return <span key={partIndex}>{part.text}</span>;
                  const slot = slotBySlot.get(part.slot);
                  return (
                    <span
                      key={partIndex}
                      className={`mx-0.5 rounded px-1.5 py-0.5 font-semibold ${
                        slot?.isCorrect
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 line-through decoration-1 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {slot?.selectedText || `(${part.slot}) ___`}
                    </span>
                  );
                })}
              </p>
            )}

            <ul className="space-y-1.5 text-sm">
              {item.slots.map((slot) => (
                <li key={slot.slot} className="flex items-start gap-2">
                  {slot.isCorrect ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" aria-label="Đúng" />
                  ) : (
                    <XCircle size={16} className="mt-0.5 shrink-0 text-red-600" aria-label="Sai" />
                  )}
                  <span className="text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">{isFill ? `Chỗ trống ${slot.slot}` : `${slot.slot}. ${slot.prompt || ''}`}:</span>{' '}
                    {slot.selectedText || <em className="text-gray-400">bỏ trống</em>}
                    {!slot.isCorrect && slot.correctText && (
                      <span className="text-green-700 dark:text-green-400"> → đáp án: {slot.correctText}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export default StructuredAnswerReviewList;
