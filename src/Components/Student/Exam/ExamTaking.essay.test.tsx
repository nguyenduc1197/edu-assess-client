import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExamTaking from './ExamTaking';
import { Question } from '../../../types';

// Requirement 9: student exam shows a textarea for essays
const essay: Question = {
  id: 'e1',
  content: 'Trình bày quyền và nghĩa vụ của công dân',
  competencyType: 'SelfDevelopment',
  questionFormat: 'Essay',
  difficultyLevel: 'Medium',
  maxPoints: 2.5,
  sampleAnswer: null,
  choices: [],
} as Question;

const mc: Question = {
  id: 'm1',
  content: 'Câu trắc nghiệm',
  competencyType: 'SelfDevelopment',
  questionFormat: 'SingleChoice',
  difficultyLevel: 'Easy',
  choices: [
    { id: 'c1', optionLabel: 'A', content: 'Đáp án A', isCorrect: false },
    { id: 'c2', optionLabel: 'B', content: 'Đáp án B', isCorrect: false },
  ],
} as Question;

const renderTaking = (props: Partial<React.ComponentProps<typeof ExamTaking>> = {}) =>
  render(
    <ExamTaking
      examTitle="Đề kiểm tra"
      questions={[essay, mc]}
      answers={{}}
      onAnswer={jest.fn()}
      onEssayAnswer={jest.fn()}
      onReview={jest.fn()}
      onExit={jest.fn()}
      {...props}
    />
  );

describe('ExamTaking essay', () => {
  it('renders a textarea (not choices) with max points label for an essay question', () => {
    renderTaking();
    expect(screen.getByText('Trình bày quyền và nghĩa vụ của công dân')).toBeInTheDocument();
    expect(screen.getByLabelText('Bài làm của em').tagName).toBe('TEXTAREA');
    expect(screen.getByText(/Câu tự luận · 2.5 điểm/)).toBeInTheDocument();
    expect(screen.queryByText('Đáp án A')).not.toBeInTheDocument();
  });

  it('calls onEssayAnswer with typed text', () => {
    const onEssayAnswer = jest.fn();
    renderTaking({ onEssayAnswer });
    fireEvent.change(screen.getByLabelText('Bài làm của em'), { target: { value: 'Bài làm của em là...' } });
    expect(onEssayAnswer).toHaveBeenCalledWith('e1', 'Bài làm của em là...');
  });

  it('shows the existing essay text from answers', () => {
    renderTaking({ answers: { e1: { essayAnswer: 'Đã viết' } } });
    expect((screen.getByLabelText('Bài làm của em') as HTMLTextAreaElement).value).toBe('Đã viết');
  });

  it('disables the textarea when exam actions are locked', () => {
    renderTaking({ disableExamActions: true });
    expect(screen.getByLabelText('Bài làm của em')).toBeDisabled();
  });

  it('whitespace-only essay does not count as answered in progress', () => {
    const { container } = renderTaking({ answers: { e1: { essayAnswer: '    ' } } });
    expect(container.textContent).toMatch(/0%/);
  });
});
