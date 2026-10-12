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

  it('prefills essay fields and rejects non-quarter max points', async () => {
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

    fireEvent.change(screen.getByLabelText(/Điểm tối đa/), { target: { value: '1.3' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu Thay Đổi/i }));
    expect(await screen.findByText(/bội số của 0\.25/)).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('shows the API error passed by the parent', async () => {
    render(<AddQuestionMenu initialQuestion={mcQuestion} onUpdateQuestion={jest.fn()} externalError="Không thể xóa đáp án đã có học sinh chọn." />);
    expect(await screen.findByText('Không thể xóa đáp án đã có học sinh chọn.')).toBeInTheDocument();
  });
});
