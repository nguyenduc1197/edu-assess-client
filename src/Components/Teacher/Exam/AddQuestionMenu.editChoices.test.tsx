import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddQuestionMenu from './AddQuestionMenu';
import { fetchClient } from '../../../api/fetchClient';
import { Question } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));
const mockedFetch = fetchClient as jest.Mock;

const q: Question = {
  id: 'q-9',
  content: 'Câu bốn đáp án',
  competencyType: 'BehaviorAdjustment',
  questionFormat: 'SingleChoice',
  difficultyLevel: 'Medium',
  hasStudentAnswers: false,
  choices: [
    { id: 'c1', optionLabel: 'A', content: 'Một', isCorrect: false },
    { id: 'c2', optionLabel: 'B', content: 'Hai', isCorrect: false },
    { id: 'c3', optionLabel: 'C', content: 'Ba', isCorrect: true },
  ],
};

// Round 2, item 6 (edit form details): ids follow their choice when removing/adding; correct answer index follows.
describe('AddQuestionMenu edit choices', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue({ ok: true, json: async () => [{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }] });
  });

  const ready = async (question: Question, onUpdate = jest.fn()) => {
    render(<AddQuestionMenu initialQuestion={question} onUpdateQuestion={onUpdate} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Điều chỉnh hành vi' })).toBeInTheDocument());
    return onUpdate;
  };

  const removeButtonFor = (value: string) => {
    const input = screen.getByDisplayValue(value);
    const row = input.parentElement!;
    const buttons = Array.from(row.querySelectorAll('button')).filter((b) => b.getAttribute('type') === 'button' || !b.getAttribute('type'));
    return buttons[buttons.length - 1];
  };

  it('removing an earlier choice keeps the correct answer and remaining ids; added choice has no id', async () => {
    const onUpdate = await ready(q);
    fireEvent.click(removeButtonFor('Một'));
    expect(screen.queryByDisplayValue('Một')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Thêm đáp án/i }));
    const inputs = screen.getAllByRole('textbox').filter((el) => (el as HTMLInputElement).value === '' && el.getAttribute('placeholder') === 'Nội dung đáp án');
    fireEvent.change(inputs[inputs.length - 1], { target: { value: 'Bốn' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/ }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const saved: Question = onUpdate.mock.calls[0][0];
    expect(saved.choices!.map((c) => [c.id, c.content, c.isCorrect])).toEqual([
      ['c2', 'Hai', false],
      ['c3', 'Ba', true],
      [undefined, 'Bốn', false],
    ]);
  });

  it('true/false edit keeps passage metadata', async () => {
    const tf: Question = {
      id: 'tf-1', content: 'Nhận định a', competencyType: 'BehaviorAdjustment', questionFormat: 'TrueFalse', difficultyLevel: 'Easy',
      passageText: 'Đoạn văn', passageGroupKey: 'G1', statementOrder: 2, hasStudentAnswers: true,
      choices: [
        { id: 't', optionLabel: 'A', content: 'Đúng', isCorrect: false },
        { id: 'f', optionLabel: 'B', content: 'Sai', isCorrect: true },
      ],
    };
    const onUpdate = await ready(tf);
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/ }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    const saved: Question = onUpdate.mock.calls[0][0];
    expect(saved.passageGroupKey).toBe('G1');
    expect(saved.statementOrder).toBe(2);
    expect(saved.passageText).toBe('Đoạn văn');
    expect(saved.choices!.map((c) => [c.id, c.isCorrect])).toEqual([['t', false], ['f', true]]);
  });
});
