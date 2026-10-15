import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddQuestionMenu from './AddQuestionMenu';
import { fetchClient } from '../../../api/fetchClient';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));

const mockedFetch = fetchClient as jest.Mock;

// Requirement 9 / round 8: teacher can choose "Tự luận" with a validated rubric (danh sách ý)
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

  // Round 8 (E): essays use a rubric ("danh sách ý"); max points = sum of ý points.
  it('shows the rubric editor (one ý worth 1 by default) and hides choices for essay', async () => {
    await setup();
    expect((screen.getByLabelText('nội dung ý 1') as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByLabelText('điểm ý 1') as HTMLInputElement).value).toBe('1');
    expect(screen.getByTestId('rubric-total')).toHaveTextContent('Điểm tối đa: 1');
    expect(screen.queryByText('Đáp Án')).not.toBeInTheDocument();
  });

  it('requires ý content (whitespace only rejected)', async () => {
    const { onAddQuestion } = await setup();
    fireEvent.change(screen.getByLabelText('nội dung ý 1'), { target: { value: '    ' } });
    submit();
    expect(await screen.findByText('Nội dung mỗi ý không được để trống.')).toBeInTheDocument();
    expect(onAddQuestion).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '1.125', '0.01', '1.3', ''])('rejects ý points %s', async (value) => {
    const { onAddQuestion } = await setup();
    fireEvent.change(screen.getByLabelText('nội dung ý 1'), { target: { value: 'Ý 1' } });
    fireEvent.change(screen.getByLabelText('điểm ý 1'), { target: { value } });
    submit();
    expect(await screen.findByText('Điểm của mỗi ý phải lớn hơn 0 và là bội số của 0.25.')).toBeInTheDocument();
    expect(onAddQuestion).not.toHaveBeenCalled();
  });

  it('rejects a total above 40', async () => {
    const { onAddQuestion } = await setup();
    fireEvent.change(screen.getByLabelText('nội dung ý 1'), { target: { value: 'Ý 1' } });
    fireEvent.change(screen.getByLabelText('điểm ý 1'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /Thêm ý/ }));
    fireEvent.change(screen.getByLabelText('nội dung ý 2'), { target: { value: 'Ý 2' } });
    fireEvent.change(screen.getByLabelText('điểm ý 2'), { target: { value: '0.25' } });
    submit();
    expect(await screen.findByText('Tổng điểm các ý phải lớn hơn 0 và không vượt quá 40.')).toBeInTheDocument();
    expect(onAddQuestion).not.toHaveBeenCalled();
  });

  it('creates an essay with rubric items; max points = sum', async () => {
    const { onAddQuestion } = await setup();
    fireEvent.change(screen.getByLabelText('nội dung ý 1'), { target: { value: '  Nêu khái niệm  ' } });
    fireEvent.change(screen.getByLabelText('điểm ý 1'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Thêm ý/ }));
    fireEvent.change(screen.getByLabelText('nội dung ý 2'), { target: { value: 'Lấy ví dụ' } });
    fireEvent.change(screen.getByLabelText('điểm ý 2'), { target: { value: '2.25' } });
    expect(screen.getByTestId('rubric-total')).toHaveTextContent('Điểm tối đa: 2.75');
    submit();
    await waitFor(() => expect(onAddQuestion).toHaveBeenCalledTimes(1));
    const q = onAddQuestion.mock.calls[0][0];
    expect(q.questionFormat).toBe('Essay');
    expect(q.content).toBe('Nêu vai trò của pháp luật');
    expect(q.rubricItems).toEqual([{ content: 'Nêu khái niệm', points: 0.5 }, { content: 'Lấy ví dụ', points: 2.25 }]);
    expect(q.maxPoints).toBe(2.75);
    expect(q.choices).toEqual([]);
    expect(q.passageText).toBeNull();
    expect(q.passageGroupKey).toBeNull();
  });

  // Round 8 (F): consecutive essays with the same situation share one group key.
  it('essays added with the same situation share a group key; a new situation starts a new group', async () => {
    const onAddQuestion = jest.fn();
    await setup(onAddQuestion);
    const addEssay = (content: string) => {
      fireEvent.change(screen.getByPlaceholderText('Nhập câu hỏi của bạn...'), { target: { value: content } });
      fireEvent.change(screen.getByLabelText('nội dung ý 1'), { target: { value: 'Ý' } });
      submit();
    };
    fireEvent.change(screen.getByLabelText('Tình huống chung (tùy chọn)'), { target: { value: ' Anh A mở cửa hàng ' } });
    addEssay('Câu a');
    await waitFor(() => expect(onAddQuestion).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText('Tình huống chung (tùy chọn)') as HTMLTextAreaElement).value).toBe(' Anh A mở cửa hàng ');
    addEssay('Câu b');
    await waitFor(() => expect(onAddQuestion).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('Tình huống chung (tùy chọn)'), { target: { value: 'Tình huống khác' } });
    addEssay('Câu c');
    await waitFor(() => expect(onAddQuestion).toHaveBeenCalledTimes(3));
    const [a, b, c] = onAddQuestion.mock.calls.map((call) => call[0]);
    expect(a.passageText).toBe('Anh A mở cửa hàng');
    expect(a.passageGroupKey).toBeTruthy();
    expect(b.passageGroupKey).toBe(a.passageGroupKey);
    expect(c.passageText).toBe('Tình huống khác');
    expect(c.passageGroupKey).not.toBe(a.passageGroupKey);
  });
});

// Round 8 (B/C): fill-in-the-blank and matching in the question form.
describe('AddQuestionMenu fill-in-the-blank and matching', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }],
    });
  });

  const setupFormat = async (format: 'FillInBlank' | 'Matching', onAddQuestion = jest.fn()) => {
    render(<AddQuestionMenu onAddQuestion={onAddQuestion} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Điều chỉnh hành vi' })).toBeInTheDocument());
    const formatSelect = screen.getByRole('option', { name: 'Tự luận' }).closest('select') as HTMLSelectElement;
    fireEvent.change(formatSelect, { target: { value: format } });
    return onAddQuestion;
  };

  const submit = () => fireEvent.click(screen.getByRole('button', { name: /Thêm Câu Hỏi/i }));

  it('creates a fill-in-the-blank question with a distractor', async () => {
    const onAddQuestion = await setupFormat('FillInBlank');
    fireEvent.change(screen.getByLabelText(/Đoạn văn/), { target: { value: 'Giá tăng thì [[1]] giảm, [[2]] tăng.' } });
    fireEvent.change(screen.getByLabelText('từ a'), { target: { value: 'lượng cầu' } });
    fireEvent.change(screen.getByLabelText('từ b'), { target: { value: 'lượng cung' } });
    fireEvent.change(screen.getByLabelText('từ c'), { target: { value: 'lạm phát' } });
    fireEvent.change(screen.getByLabelText('đáp án cho từ a'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('đáp án cho từ b'), { target: { value: '2' } });
    submit();
    await waitFor(() => expect(onAddQuestion).toHaveBeenCalledTimes(1));
    const q = onAddQuestion.mock.calls[0][0];
    expect(q.questionFormat).toBe('FillInBlank');
    expect(q.choices.map((c: any) => [c.optionLabel, c.content, c.correctSlot, c.isCorrect])).toEqual([
      ['A', 'lượng cầu', 1, true],
      ['B', 'lượng cung', 2, true],
      ['C', 'lạm phát', null, false],
    ]);
  });

  it('rejects a blank without an answer and a passage without blanks', async () => {
    const onAddQuestion = await setupFormat('FillInBlank');
    fireEvent.change(screen.getByLabelText(/Đoạn văn/), { target: { value: 'Không có chỗ trống' } });
    submit();
    expect(await screen.findByText('Đoạn văn phải có ít nhất một chỗ trống dạng [[1]].')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Đoạn văn/), { target: { value: '[[1]] và [[2]]' } });
    ['a', 'b', 'c'].forEach((label, i) => fireEvent.change(screen.getByLabelText(`từ ${label}`), { target: { value: `w${i}` } }));
    fireEvent.change(screen.getByLabelText('đáp án cho từ a'), { target: { value: '1' } });
    submit();
    expect(await screen.findByText('Mỗi chỗ trống / vế cột A phải có đúng một đáp án đúng.')).toBeInTheDocument();
    expect(onAddQuestion).not.toHaveBeenCalled();
  });

  it('assigning a blank to another word frees the previous word', async () => {
    await setupFormat('FillInBlank');
    fireEvent.change(screen.getByLabelText(/Đoạn văn/), { target: { value: '[[1]]' } });
    fireEvent.change(screen.getByLabelText('đáp án cho từ a'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('đáp án cho từ b'), { target: { value: '1' } });
    expect((screen.getByLabelText('đáp án cho từ a') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('đáp án cho từ b') as HTMLSelectElement).value).toBe('1');
  });

  it('creates a matching question with an extra column B item', async () => {
    const onAddQuestion = await setupFormat('Matching');
    fireEvent.change(screen.getByLabelText('Nội Dung Câu Hỏi'), { target: { value: 'Nối cột A với cột B' } });
    fireEvent.change(screen.getByLabelText('cột A vế 1'), { target: { value: 'Cung' } });
    fireEvent.change(screen.getByLabelText('cột A vế 2'), { target: { value: 'Cầu' } });
    fireEvent.change(screen.getByLabelText('cột B mục a'), { target: { value: 'Người bán' } });
    fireEvent.change(screen.getByLabelText('cột B mục b'), { target: { value: 'Người mua' } });
    fireEvent.change(screen.getByLabelText('cột B mục c'), { target: { value: 'Nhà nước' } });
    fireEvent.change(screen.getByLabelText('đáp án cho mục a'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('đáp án cho mục b'), { target: { value: '2' } });
    submit();
    await waitFor(() => expect(onAddQuestion).toHaveBeenCalledTimes(1));
    const q = onAddQuestion.mock.calls[0][0];
    expect(q.questionFormat).toBe('Matching');
    expect(q.matchingPrompts).toEqual(['Cung', 'Cầu']);
    expect(q.choices.map((c: any) => c.correctSlot)).toEqual([1, 2, null]);
  });

  it('removing a column A item shifts later answers and clears the removed one', async () => {
    await setupFormat('Matching');
    fireEvent.click(screen.getByRole('button', { name: /Thêm vế cột A/ }));
    fireEvent.change(screen.getByLabelText('đáp án cho mục a'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('đáp án cho mục c'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('xóa vế A 1'));
    expect((screen.getByLabelText('đáp án cho mục a') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('đáp án cho mục c') as HTMLSelectElement).value).toBe('2');
  });
});
