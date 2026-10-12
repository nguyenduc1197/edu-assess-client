import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddQuestionMenu from './AddQuestionMenu';
import { fetchClient } from '../../../api/fetchClient';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));

const mockedFetch = fetchClient as jest.Mock;

// Requirement 9: teacher can choose "Tự luận" with required sample answer + max points validation
describe('AddQuestionMenu essay', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }],
    });
  });

  const setup = async (onAddQuestion = jest.fn()) => {
    const { container } = render(<AddQuestionMenu onAddQuestion={onAddQuestion} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Điều chỉnh hành vi' })).toBeInTheDocument());
    const formatSelect = screen.getByRole('option', { name: 'Tự luận' }).closest('select') as HTMLSelectElement;
    fireEvent.change(formatSelect, { target: { value: 'Essay' } });
    fireEvent.change(screen.getByPlaceholderText('Nhập câu hỏi của bạn...'), { target: { value: '  Nêu vai trò của pháp luật  ' } });
    return { container, onAddQuestion };
  };

  const submit = () => fireEvent.click(screen.getByRole('button', { name: /Thêm Câu Hỏi/i }));

  it('offers the "Tự luận" option', async () => {
    render(<AddQuestionMenu onAddQuestion={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Tự luận' })).toBeInTheDocument());
  });

  it('shows sample answer + max points fields (default 1) and hides choices for essay', async () => {
    await setup();
    expect(screen.getByLabelText(/Đáp án mẫu \/ tiêu chí chấm/)).toBeInTheDocument();
    const max = screen.getByLabelText(/Điểm tối đa/) as HTMLInputElement;
    expect(max.value).toBe('1');
    expect(screen.queryByText('Đáp Án')).not.toBeInTheDocument();
  });

  it('requires a sample answer (whitespace only rejected)', async () => {
    const { onAddQuestion } = await setup();
    fireEvent.change(screen.getByLabelText(/Đáp án mẫu \/ tiêu chí chấm/), { target: { value: '    ' } });
    submit();
    expect(await screen.findByText('Câu tự luận bắt buộc phải có đáp án mẫu / tiêu chí chấm.')).toBeInTheDocument();
    expect(onAddQuestion).not.toHaveBeenCalled();
  });

  it.each(['0', '10.01', '-1'])('rejects max points %s', async (value) => {
    const { onAddQuestion } = await setup();
    fireEvent.change(screen.getByLabelText(/Đáp án mẫu \/ tiêu chí chấm/), { target: { value: 'Ý 1' } });
    fireEvent.change(screen.getByLabelText(/Điểm tối đa/), { target: { value } });
    submit();
    expect(await screen.findByText('Điểm tối đa của câu tự luận phải lớn hơn 0 và không vượt quá 10.')).toBeInTheDocument();
    expect(onAddQuestion).not.toHaveBeenCalled();
  });

  it('rejects max points with more than 2 decimals', async () => {
    const { onAddQuestion } = await setup();
    fireEvent.change(screen.getByLabelText(/Đáp án mẫu \/ tiêu chí chấm/), { target: { value: 'Ý 1' } });
    fireEvent.change(screen.getByLabelText(/Điểm tối đa/), { target: { value: '1.125' } });
    submit();
    expect(await screen.findByText(/2 chữ số thập phân/)).toBeInTheDocument();
    expect(onAddQuestion).not.toHaveBeenCalled();
  });

  it.each([
    ['0.01', 0.01],
    ['10', 10],
    ['2.5', 2.5],
  ])('creates essay with max points %s', async (input, expected) => {
    const { onAddQuestion } = await setup();
    fireEvent.change(screen.getByLabelText(/Đáp án mẫu \/ tiêu chí chấm/), { target: { value: '  Ý 1; Ý 2  ' } });
    fireEvent.change(screen.getByLabelText(/Điểm tối đa/), { target: { value: input } });
    submit();
    await waitFor(() => expect(onAddQuestion).toHaveBeenCalledTimes(1));
    const q = onAddQuestion.mock.calls[0][0];
    expect(q.questionFormat).toBe('Essay');
    expect(q.content).toBe('Nêu vai trò của pháp luật');
    expect(q.sampleAnswer).toBe('Ý 1; Ý 2');
    expect(q.maxPoints).toBe(expected);
    expect(q.choices).toEqual([]);
  });
});
