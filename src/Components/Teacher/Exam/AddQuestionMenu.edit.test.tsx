import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddQuestionMenu from './AddQuestionMenu';
import { fetchClient } from '../../../api/fetchClient';
import { Question } from '../../../types';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));

const mockedFetch = fetchClient as jest.Mock;

const mcQuestion: Question = {
  id: 'q-1',
  content: 'Câu trắc nghiệm',
  competencyType: 'SelfDevelopment',
  questionFormat: 'SingleChoice',
  difficultyLevel: 'Hard',
  hasStudentAnswers: true,
  choices: [
    { id: 'c-a', optionLabel: 'A', content: 'Đáp án A', isCorrect: false },
    { id: 'c-b', optionLabel: 'B', content: 'Đáp án B', isCorrect: true },
  ],
};

// Round 2: question editing reuses the add form (prefilled), format locked when students answered.
describe('AddQuestionMenu edit mode', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' },
        { value: 'SelfDevelopment', label: 'Phát triển bản thân' },
      ],
    });
  });

  const formatSelect = () => screen.getByRole('option', { name: 'Tự luận' }).closest('select') as HTMLSelectElement;

  it('prefills the form and keeps choice ids on save', async () => {
    const onUpdate = jest.fn();
    render(<AddQuestionMenu initialQuestion={mcQuestion} onUpdateQuestion={onUpdate} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Phát triển bản thân' })).toBeInTheDocument());

    expect(screen.getByText('Chỉnh Sửa Câu Hỏi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Câu trắc nghiệm')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Đáp án B')).toBeInTheDocument();
    expect(formatSelect()).toBeDisabled();
    expect(screen.getByText(/không thể đổi định dạng/)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Đáp án A'), { target: { value: 'Đáp án A sửa' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const q: Question = onUpdate.mock.calls[0][0];
    expect(q.id).toBe('q-1');
    expect(q.competencyType).toBe('SelfDevelopment');
    expect(q.difficultyLevel).toBe('Hard');
    expect(q.choices).toEqual([
      { id: 'c-a', optionLabel: 'A', content: 'Đáp án A sửa', isCorrect: false },
      { id: 'c-b', optionLabel: 'B', content: 'Đáp án B', isCorrect: true },
    ]);
  });

  it('allows changing format when no student answered', async () => {
    render(<AddQuestionMenu initialQuestion={{ ...mcQuestion, hasStudentAnswers: false }} onUpdateQuestion={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Phát triển bản thân' })).toBeInTheDocument());
    expect(formatSelect()).not.toBeDisabled();
  });

  // Round 8: a legacy essay (sample answer + max points) becomes one ý worth the old max points.
  it('prefills a legacy essay as one ý and rejects non-quarter ý points', async () => {
    const onUpdate = jest.fn();
    render(
      <AddQuestionMenu
        initialQuestion={{ id: 'e-1', content: 'Tự luận', questionFormat: 'Essay', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Medium', maxPoints: 2.5, sampleAnswer: 'Ý chính', choices: [] }}
        onUpdateQuestion={onUpdate}
      />
    );
    await waitFor(() => expect(screen.getByRole('option', { name: 'Điều chỉnh hành vi' })).toBeInTheDocument());
    expect(screen.getByDisplayValue('Ý chính')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();

    expect(screen.getByTestId('rubric-total')).toHaveTextContent('Điểm tối đa: 2.5');
    fireEvent.change(screen.getByLabelText('điểm ý 1'), { target: { value: '1.3' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/i }));
    expect(await screen.findByText(/bội số của 0\.25/)).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('edits an essay rubric and its shared situation, keeping the group key', async () => {
    const onUpdate = jest.fn();
    render(
      <AddQuestionMenu
        initialQuestion={{ id: 'e-2', content: 'Câu a', questionFormat: 'Essay', competencyType: 'BehaviorAdjustment', difficultyLevel: 'Medium', maxPoints: 1.5, rubricItems: [{ content: 'Ý 1', points: 1 }, { content: 'Ý 2', points: 0.5 }], passageText: 'Tình huống', passageGroupKey: 'g-1', choices: [] }}
        onUpdateQuestion={onUpdate}
      />
    );
    await waitFor(() => expect(screen.getByRole('option', { name: 'Điều chỉnh hành vi' })).toBeInTheDocument());
    expect(screen.getByText(/áp dụng cho tất cả câu tự luận dùng chung/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tình huống chung (tùy chọn)'), { target: { value: 'Tình huống mới' } });
    fireEvent.change(screen.getByLabelText('điểm ý 2'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/i }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const q = onUpdate.mock.calls[0][0];
    expect(q.rubricItems).toEqual([{ content: 'Ý 1', points: 1 }, { content: 'Ý 2', points: 1 }]);
    expect(q.maxPoints).toBe(2);
    expect(q.passageText).toBe('Tình huống mới');
    expect(q.passageGroupKey).toBe('g-1');
  });

  it('shows the API error passed by the parent', async () => {
    render(<AddQuestionMenu initialQuestion={mcQuestion} onUpdateQuestion={jest.fn()} externalError="Không thể xóa đáp án đã có học sinh chọn." />);
    expect(await screen.findByText('Không thể xóa đáp án đã có học sinh chọn.')).toBeInTheDocument();
  });
});

// Round 6: question content limit is 4000 characters.
describe('AddQuestionMenu content length', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue({ ok: true, json: async () => [{ value: 'SelfDevelopment', label: 'Phát triển bản thân' }] });
  });

  it('accepts 4000 characters and rejects 4001', async () => {
    const onUpdate = jest.fn();
    render(<AddQuestionMenu initialQuestion={{ ...mcQuestion, hasStudentAnswers: false }} onUpdateQuestion={onUpdate} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Phát triển bản thân' })).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Câu trắc nghiệm'), { target: { value: 'x'.repeat(4001) } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/i }));
    expect(await screen.findByText('Nội dung câu hỏi không được vượt quá 4000 ký tự.')).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue('x'.repeat(4001)), { target: { value: 'x'.repeat(4000) } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/i }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  });
});
