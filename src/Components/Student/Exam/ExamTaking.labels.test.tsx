import React from 'react';
import { render, screen } from '@testing-library/react';
import ExamTaking from './ExamTaking';
import { Question } from '../../../types';

// Round 2, item 6 side effect: students see "A."/"B." labels; no correctness information is rendered.
const mc = {
  id: 'm1',
  content: 'Câu trắc nghiệm',
  competencyType: 'SelfDevelopment',
  questionFormat: 'SingleChoice',
  difficultyLevel: 'Easy',
  choices: [
    { id: 'c1', optionLabel: 'A', content: 'Đáp án thứ nhất', isCorrect: null },
    { id: 'c2', optionLabel: 'B', content: 'Đáp án thứ hai', isCorrect: null },
  ],
} as unknown as Question;

it('shows option labels before choices while taking an exam', () => {
  const { container } = render(
    <ExamTaking examTitle="Đề" questions={[mc]} answers={{}} onAnswer={jest.fn()} onReview={jest.fn()} onExit={jest.fn()} />
  );
  expect(screen.getByText('Đáp án thứ nhất')).toBeInTheDocument();
  expect(container.textContent).toMatch(/A\.\s*Đáp án thứ nhất/);
  expect(container.textContent).toMatch(/B\.\s*Đáp án thứ hai/);
  expect(container.textContent).not.toMatch(/Đáp án đúng/);
});
