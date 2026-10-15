import React, { useRef, useState } from 'react';
import { Choice, Question, SlotAnswer } from '../../../types';
import { placeChoice, slotCountOf, splitBlankPassage } from '../../../utils/structuredQuestion';

interface StructuredAnswerInputProps {
  question: Question;
  slotAnswers: SlotAnswer[];
  onChange: (slotAnswers: SlotAnswer[]) => void;
  disabled?: boolean;
}

/** Drop target under the pointer: a slot number, or 'bank' to send the word back. */
type DropTarget = number | 'bank' | null;

const DRAG_THRESHOLD_PX = 6;

const findDropTarget = (x: number, y: number): DropTarget => {
  if (typeof document.elementFromPoint !== 'function') return null;
  const element = document.elementFromPoint(x, y) as HTMLElement | null;
  const target = element?.closest<HTMLElement>('[data-drop-slot], [data-drop-bank]');
  if (!target) return null;
  if (target.dataset.dropBank !== undefined) return 'bank';
  const slot = Number(target.dataset.dropSlot);
  return Number.isFinite(slot) ? slot : null;
};

/**
 * Student input for fill-in-the-blank / matching. Main interaction is tap-to-select (tap a word, then a blank,
 * or the other way round; tap a filled blank to clear it). Drag and drop (Pointer Events: mouse, touch, pen)
 * is offered on top. Each word / column B item is used at most once.
 */
const StructuredAnswerInput: React.FC<StructuredAnswerInputProps> = ({ question, slotAnswers, onChange, disabled = false }) => {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ choiceId: string; label: string; x: number; y: number; over: DropTarget } | null>(null);
  const pointerStart = useRef<{ id: number; choiceId: string; x: number; y: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);

  const isFill = question.questionFormat === 'FillInBlank';
  const choices = question.choices || [];
  const slotCount = slotCountOf(question);
  const choiceById = new Map(choices.map((choice) => [choice.id, choice]));
  const choiceInSlot = (slot: number) => {
    const id = slotAnswers.find((answer) => answer.slot === slot)?.choiceId;
    return id ? choiceById.get(id) : undefined;
  };
  const usedIds = new Set(slotAnswers.map((answer) => answer.choiceId));
  const bank = choices.filter((choice) => choice.id && !usedIds.has(choice.id));

  const place = (slot: number, choiceId: string | null) => {
    onChange(placeChoice(slotAnswers, slot, choiceId));
    setSelectedChoiceId(null);
    setSelectedSlot(null);
  };

  const removeChoice = (choiceId: string) => {
    const slot = slotAnswers.find((answer) => answer.choiceId === choiceId)?.slot;
    if (slot !== undefined) place(slot, null);
  };

  const handleChoiceTap = (choiceId: string) => {
    if (disabled) return;
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (selectedSlot !== null) {
      place(selectedSlot, choiceId);
      return;
    }
    setSelectedChoiceId((current) => (current === choiceId ? null : choiceId));
  };

  const handleSlotTap = (slot: number) => {
    if (disabled) return;
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (selectedChoiceId) {
      place(slot, selectedChoiceId);
      return;
    }
    if (choiceInSlot(slot)) {
      place(slot, null);
      return;
    }
    setSelectedSlot((current) => (current === slot ? null : slot));
  };

  // ---- drag and drop (Pointer Events) ----
  const onPointerDown = (event: React.PointerEvent<HTMLElement>, choice: Choice) => {
    if (disabled || !choice.id || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerStart.current = { id: event.pointerId, choiceId: choice.id, x: event.clientX, y: event.clientY, dragging: false };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>, choice: Choice) => {
    const start = pointerStart.current;
    if (!start || start.id !== event.pointerId) return;
    if (!start.dragging) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_THRESHOLD_PX) return;
      start.dragging = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // capture is best effort (not available in some test environments)
      }
    }
    event.preventDefault();
    setDrag({
      choiceId: start.choiceId,
      label: choice.content,
      x: event.clientX,
      y: event.clientY,
      over: findDropTarget(event.clientX, event.clientY),
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId || !start.dragging) return;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const target = findDropTarget(event.clientX, event.clientY);
    setDrag(null);
    if (target === 'bank') removeChoice(start.choiceId);
    else if (typeof target === 'number') place(target, start.choiceId);
  };

  const dragHandlers = (choice: Choice) => ({
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => onPointerDown(event, choice),
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => onPointerMove(event, choice),
    onPointerUp: endDrag,
    onPointerCancel: () => {
      pointerStart.current = null;
      setDrag(null);
    },
  });

  const chipClass = (active: boolean) =>
    `inline-flex min-h-10 select-none items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? 'border-primary bg-primary text-white'
        : 'border-gray-300 bg-white text-gray-800 hover:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
    } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-grab'}`;

  const renderSlot = (slot: number, label: string) => {
    const filled = choiceInSlot(slot);
    const isActive = selectedSlot === slot || drag?.over === slot;
    return (
      <button
        key={`slot-${slot}`}
        type="button"
        data-drop-slot={slot}
        aria-label={filled ? `${label}: ${filled.content} (chạm để bỏ)` : `${label}: trống`}
        onClick={() => handleSlotTap(slot)}
        disabled={disabled}
        style={{ touchAction: filled ? 'none' : undefined }}
        {...(filled ? dragHandlers(filled) : {})}
        className={`mx-1 inline-flex min-h-10 min-w-[6rem] items-center justify-center rounded-lg border-2 border-dashed px-2 py-1 align-middle text-sm font-semibold transition-colors ${
          filled
            ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
            : isActive
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-gray-300 text-gray-400 dark:border-gray-600'
        }`}
      >
        {filled ? filled.content : isFill ? `(${slot})` : '…'}
      </button>
    );
  };

  return (
    <div className="space-y-5" data-testid="structured-answer">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {isFill
          ? 'Chạm vào một từ rồi chạm vào chỗ trống (hoặc kéo thả từ vào chỗ trống). Chạm vào chỗ trống đã điền để bỏ. Mỗi từ chỉ dùng một lần.'
          : 'Chạm vào một ý ở cột B rồi chạm vào ô bên cạnh ý ở cột A (hoặc kéo thả). Chạm vào ô đã ghép để bỏ. Mỗi ý chỉ dùng một lần.'}
      </p>

      {isFill ? (
        <p className="whitespace-pre-line text-lg leading-[3rem] text-gray-900 dark:text-gray-100">
          {splitBlankPassage(question.content).map((part, index) =>
            part.kind === 'text' ? <span key={index}>{part.text}</span> : renderSlot(part.slot, `Chỗ trống ${part.slot}`)
          )}
        </p>
      ) : (
        <ol className="space-y-3">
          {(question.matchingPrompts || []).slice(0, slotCount).map((prompt, index) => (
            <li
              key={index}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-base text-gray-900 dark:text-gray-100">
                <span className="mr-2 font-bold text-primary">{index + 1}.</span>
                {prompt}
              </span>
              {renderSlot(index + 1, `Ghép cho ý ${index + 1}`)}
            </li>
          ))}
        </ol>
      )}

      <div
        data-drop-bank=""
        className={`rounded-xl border p-3 transition-colors ${
          drag?.over === 'bank' ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40'
        }`}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {isFill ? 'Ngân hàng từ' : 'Cột B'}
        </p>
        {bank.length === 0 ? (
          <p className="text-sm text-gray-400">Đã dùng hết.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bank.map((choice) => (
              <button
                key={choice.id}
                type="button"
                aria-pressed={selectedChoiceId === choice.id}
                onClick={() => handleChoiceTap(choice.id!)}
                disabled={disabled}
                style={{ touchAction: 'none' }}
                {...dragHandlers(choice)}
                className={chipClass(selectedChoiceId === choice.id)}
              >
                {choice.content}
              </button>
            ))}
          </div>
        )}
      </div>

      {drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-white shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.label}
        </div>
      )}
    </div>
  );
};

export default StructuredAnswerInput;
