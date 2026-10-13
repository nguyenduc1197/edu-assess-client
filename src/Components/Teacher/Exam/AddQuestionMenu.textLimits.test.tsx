import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddQuestionMenu from './AddQuestionMenu';
import { fetchClient } from '../../../api/fetchClient';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));
const mockedFetch = fetchClient as jest.Mock;

// Round 6 (TEST agent): question content limit 4000 in the add form (boundary 4000 ok / 4001 rejected).
describe('AddQuestionMenu content length limit', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue({ ok: true, json: async () => [{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }] });
  });

  const fill = async (content: string) => {
    const onAdd = jest.fn();
    render(<AddQuestionMenu onAddQuestion={onAdd} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Điều chỉnh hành vi' })).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Nhập câu hỏi của bạn...'), { target: { value: content } });
    screen.getAllByPlaceholderText('Nội dung đáp án').forEach((input, i) => fireEvent.change(input, { target: { value: `Đáp án ${i}` } }));
    fireEvent.click(screen.getByRole('button', { name: /Thêm Câu Hỏi/ }));
    return onAdd;
  };

  it('accepts exactly 4000 characters (whitespace around not counted)', async () => {
    const onAdd = await fill('  ' + 'x'.repeat(4000) + '  ');
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0][0].content).toHaveLength(4000);
  });

  it('rejects 4001 characters with the backend message', async () => {
    const onAdd = await fill('x'.repeat(4001));
    expect(await screen.findByText('Nội dung câu hỏi không được vượt quá 4000 ký tự.')).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
