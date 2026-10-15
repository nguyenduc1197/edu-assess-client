import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import StructuredAnswerInput from './StructuredAnswerInput';
import { Question, SlotAnswer } from '../../../types';
import { buildAnswerPayload, hasAnswerContent, restoreDraftAnswers } from '../../../utils/essay';

// jsdom has no PointerEvent: without it fireEvent drops clientX / pointerId.
if (!(window as any).PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: any = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (window as any).PointerEvent = PointerEventPolyfill;
}

// Round 8 (D): students answer fill-in-the-blank / matching by tapping and by drag and drop (touch + mouse).
const fillQuestion: Question = {
  id: 'f1',
  content: 'Giá tăng thì [[1]] giảm, [[2]] tăng.',
  questionFormat: 'FillInBlank',
  choices: [
    { id: 'w1', optionLabel: 'A', content: 'lượng cầu' },
    { id: 'w2', optionLabel: 'B', content: 'lượng cung' },
    { id: 'w3', optionLabel: 'C', content: 'lạm phát' },
  ],
};

const matchQuestion: Question = {
  id: 'm1',
  content: 'Nối cột A với cột B',
  questionFormat: 'Matching',
  matchingPrompts: ['Cung', 'Cầu'],
  choices: [
    { id: 'b1', optionLabel: 'A', content: 'Người bán' },
    { id: 'b2', optionLabel: 'B', content: 'Người mua' },
    { id: 'b3', optionLabel: 'C', content: 'Nhà nước' },
  ],
};

const Harness: React.FC<{ question: Question; initial?: SlotAnswer[]; disabled?: boolean; onChange?: (v: SlotAnswer[]) => void }> = ({
  question,
  initial = [],
  disabled,
  onChange,
}) => {
  const [value, setValue] = useState<SlotAnswer[]>(initial);
  return (
    <StructuredAnswerInput
      question={question}
      slotAnswers={value}
      disabled={disabled}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

const word = (name: string) => screen.getByRole('button', { name });

describe('StructuredAnswerInput – tap to select', () => {
  it('renders the passage with blanks and never shows raw [[n]] markers', () => {
    render(<Harness question={fillQuestion} />);
    expect(screen.queryByText(/\[\[/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỗ trống 1: trống' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chỗ trống 2: trống' })).toBeInTheDocument();
  });

  it('word then blank fills it and removes the word from the bank', () => {
    const onChange = jest.fn();
    render(<Harness question={fillQuestion} onChange={onChange} />);
    fireEvent.click(word('lượng cầu'));
    expect(word('lượng cầu')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Chỗ trống 1: trống' }));
    expect(onChange).toHaveBeenLastCalledWith([{ slot: 1, choiceId: 'w1' }]);
    expect(screen.getByRole('button', { name: /Chỗ trống 1: lượng cầu/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'lượng cầu' })).not.toBeInTheDocument();
  });

  it('blank then word also works; tapping a filled blank returns the word to the bank', () => {
    const onChange = jest.fn();
    render(<Harness question={fillQuestion} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chỗ trống 2: trống' }));
    fireEvent.click(word('lạm phát'));
    expect(onChange).toHaveBeenLastCalledWith([{ slot: 2, choiceId: 'w3' }]);
    fireEvent.click(screen.getByRole('button', { name: /Chỗ trống 2: lạm phát/ }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(word('lạm phát')).toBeInTheDocument();
  });

  it('placing a word on a filled blank sends the previous word back to the bank', () => {
    const onChange = jest.fn();
    render(<Harness question={fillQuestion} initial={[{ slot: 1, choiceId: 'w1' }]} onChange={onChange} />);
    fireEvent.click(word('lượng cung'));
    fireEvent.click(screen.getByRole('button', { name: /Chỗ trống 1: lượng cầu/ }));
    expect(onChange).toHaveBeenLastCalledWith([{ slot: 1, choiceId: 'w2' }]);
    expect(word('lượng cầu')).toBeInTheDocument();
  });

  it('matching: one box per column A item', () => {
    const onChange = jest.fn();
    render(<Harness question={matchQuestion} onChange={onChange} />);
    expect(screen.getByText('Cung')).toBeInTheDocument();
    fireEvent.click(word('Người mua'));
    fireEvent.click(screen.getByRole('button', { name: 'Ghép cho ý 2: trống' }));
    expect(onChange).toHaveBeenLastCalledWith([{ slot: 2, choiceId: 'b2' }]);
  });

  it('does nothing when locked', () => {
    const onChange = jest.fn();
    render(<Harness question={fillQuestion} disabled onChange={onChange} />);
    fireEvent.click(word('lượng cầu'));
    fireEvent.click(screen.getByRole('button', { name: 'Chỗ trống 1: trống' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('StructuredAnswerInput – drag and drop (pointer events)', () => {
  const original = document.elementFromPoint;
  afterEach(() => {
    document.elementFromPoint = original;
  });

  const dropOn = (element: Element) => {
    document.elementFromPoint = jest.fn(() => element);
  };

  const drag = (source: Element, pointerType = 'touch') => {
    fireEvent.pointerDown(source, { pointerId: 1, clientX: 10, clientY: 10, pointerType, button: 0 });
    fireEvent.pointerMove(source, { pointerId: 1, clientX: 40, clientY: 40, pointerType });
    fireEvent.pointerUp(source, { pointerId: 1, clientX: 40, clientY: 40, pointerType });
  };

  it('dragging a word onto a blank fills it (touch)', () => {
    const onChange = jest.fn();
    render(<Harness question={fillQuestion} onChange={onChange} />);
    dropOn(screen.getByRole('button', { name: 'Chỗ trống 2: trống' }));
    drag(word('lượng cung'));
    expect(onChange).toHaveBeenLastCalledWith([{ slot: 2, choiceId: 'w2' }]);
  });

  it('dragging a placed word to another blank moves it; dropping on the bank removes it (mouse)', () => {
    const onChange = jest.fn();
    render(<Harness question={fillQuestion} initial={[{ slot: 1, choiceId: 'w1' }]} onChange={onChange} />);
    dropOn(screen.getByRole('button', { name: 'Chỗ trống 2: trống' }));
    drag(screen.getByRole('button', { name: /Chỗ trống 1: lượng cầu/ }), 'mouse');
    expect(onChange).toHaveBeenLastCalledWith([{ slot: 2, choiceId: 'w1' }]);

    dropOn(screen.getByText('Ngân hàng từ'));
    drag(screen.getByRole('button', { name: /Chỗ trống 2: lượng cầu/ }), 'mouse');
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('a tiny movement is a tap, not a drag', () => {
    const onChange = jest.fn();
    render(<Harness question={fillQuestion} onChange={onChange} />);
    const chip = word('lượng cầu');
    fireEvent.pointerDown(chip, { pointerId: 1, clientX: 10, clientY: 10, pointerType: 'touch' });
    fireEvent.pointerMove(chip, { pointerId: 1, clientX: 12, clientY: 11, pointerType: 'touch' });
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: 12, clientY: 11, pointerType: 'touch' });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('dropping outside any target changes nothing', () => {
    const onChange = jest.fn();
    render(<Harness question={fillQuestion} onChange={onChange} />);
    dropOn(document.body);
    drag(word('lượng cầu'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('slot answers in submit payload and draft restore', () => {
  it('sends slotAnswers (empty slots dropped) and counts a question as answered', () => {
    const payload = buildAnswerPayload({ f1: { slotAnswers: [{ slot: 1, choiceId: 'w1' }, { slot: 2, choiceId: null }] } });
    expect(payload).toEqual([{ questionId: 'f1', choiceId: null, essayAnswer: null, slotAnswers: [{ slot: 1, choiceId: 'w1' }] }]);
    expect(hasAnswerContent({ slotAnswers: [{ slot: 1, choiceId: 'w1' }] })).toBe(true);
    expect(hasAnswerContent({ slotAnswers: [] })).toBe(false);
  });

  it('restores draft slots, dropping unknown slots / choices and duplicate use of a word', () => {
    const restored = restoreDraftAnswers(
      [
        {
          questionId: 'f1',
          slotAnswers: [
            { slot: 1, choiceId: 'w1' },
            { slot: 2, choiceId: 'w1' },
            { slot: 3, choiceId: 'w2' },
            { slot: 2, choiceId: 'gone' },
          ],
        },
        { questionId: 'm1', slotAnswers: [] },
      ],
      [fillQuestion, matchQuestion]
    );
    expect(restored).toEqual({ f1: { slotAnswers: [{ slot: 2, choiceId: 'w1' }] } });
  });
});
