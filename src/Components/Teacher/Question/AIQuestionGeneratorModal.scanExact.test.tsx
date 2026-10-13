import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AIQuestionGeneratorModal from './AIQuestionGeneratorModal';
import { fetchClient } from '../../../api/fetchClient';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));
const mockedFetch = fetchClient as jest.Mock;

const competencyOptions = [{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }];

// Round 7: "Tạo đề giống file gốc" is the third tab of the "Tạo bài thi bằng AI" window.
describe('AIQuestionGeneratorModal scanExact tab', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
  });

  it('shows three tabs in exam variant mode and renders ScanExamFlow in the third', () => {
    render(<AIQuestionGeneratorModal competencyOptions={competencyOptions} enableExamVariantMode onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Tạo câu hỏi từ nội dung' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo đề biến thể từ ảnh scan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo đề mới từ ảnh scan' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('scan-exam-flow')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo đề giống file gốc' }));
    expect(screen.getByTestId('scan-exam-flow')).toBeInTheDocument();
    expect(screen.getByLabelText('Chọn file đề thi')).toBeInTheDocument();
    // the content / variant form is not shown on this tab
    expect(screen.queryByText('Nguồn nội dung')).not.toBeInTheDocument();
  });

  it('the notice in the content tab switches to the scanExact tab', () => {
    render(<AIQuestionGeneratorModal competencyOptions={competencyOptions} enableExamVariantMode onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang "Tạo đề giống file gốc"' }));
    expect(screen.getByTestId('scan-exam-flow')).toBeInTheDocument();
  });

  it('can hide the scanExact tab (editing an existing exam)', () => {
    render(<AIQuestionGeneratorModal competencyOptions={competencyOptions} enableExamVariantMode enableScanExactTab={false} onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Tạo đề biến thể từ ảnh scan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo đề giống file gốc' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    expect(screen.queryByRole('button', { name: /Chuyển sang/ })).not.toBeInTheDocument();
  });

  it('has no tabs outside exam variant mode (question bank)', () => {
    render(<AIQuestionGeneratorModal competencyOptions={competencyOptions} onClose={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Tạo đề giống file gốc' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo đề biến thể từ ảnh scan' })).not.toBeInTheDocument();
  });
});
