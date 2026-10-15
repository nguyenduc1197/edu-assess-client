import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateExamModal from './CreateExamModal';
import { fetchClient } from '../../../api/fetchClient';

jest.mock('../../../api/fetchClient', () => ({ fetchClient: jest.fn() }));
const mockedFetch = fetchClient as jest.Mock;

// ScanExamFlow is replaced by a probe that shows the received fields and can simulate a successful creation.
jest.mock('./ScanExamFlow', () => ({
  __esModule: true,
  default: ({ initialExamFields, onCreated }: any) => (
    <div data-testid="scan-exam-flow">
      <span data-testid="flow-fields">{JSON.stringify(initialExamFields)}</span>
      <button type="button" onClick={() => onCreated('ex-new')}>simulate created</button>
    </div>
  ),
}));

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

const openScanExactTab = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Tạo câu hỏi bằng AI/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Tạo đề giống file gốc' }));
  return screen.findByTestId('scan-exam-flow');
};

// Round 7: CreateExamModal -> "Tạo câu hỏi bằng AI" -> "Tạo đề giống file gốc"
describe('CreateExamModal scanExact', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => {
      if (url.startsWith('/classes')) return ok([{ id: 'c1', name: '10A1' }]);
      if (url === '/questions/competency-types') return ok([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]);
      return ok([]);
    });
  });

  it('passes the values already entered in the form', async () => {
    render(<CreateExamModal onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Tên Bài Tập'), { target: { value: 'Đề GV nhập' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '10A1' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Lớp'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/Thời gian bắt đầu/), { target: { value: '2026-10-20T08:00' } });
    fireEvent.change(screen.getByLabelText(/Thời gian kết thúc/), { target: { value: '2026-10-21T08:00' } });
    fireEvent.change(screen.getByLabelText(/Thời lượng làm bài/), { target: { value: '30' } });

    await openScanExactTab();
    expect(JSON.parse(screen.getByTestId('flow-fields').textContent || '{}')).toEqual({
      name: 'Đề GV nhập',
      schoolClassId: 'c1',
      start: '2026-10-20T08:00',
      end: '2026-10-21T08:00',
      durationMinutes: '30',
      antiCheatEnabled: false,
      trueFalseScoringMode: 'Tiered',
    });
  });

  it('on success closes the windows and reports the message through onSuccess', async () => {
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    render(<CreateExamModal onClose={onClose} onSuccess={onSuccess} />);
    await openScanExactTab();
    fireEvent.click(screen.getByRole('button', { name: 'simulate created' }));
    expect(onSuccess).toHaveBeenCalledWith('Đã tạo bài thi từ file đề.');
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByTestId('scan-exam-flow')).not.toBeInTheDocument();
  });

  it('hides the scanExact tab while editing an existing exam', async () => {
    render(
      <CreateExamModal
        onClose={jest.fn()}
        examToEdit={{ id: 'ex1', name: 'Đề cũ', start: '2026-10-01T00:00:00', end: '2026-10-02T00:00:00', durationMinutes: 45, questionIds: [], schoolClassId: 'c1' }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Tạo câu hỏi bằng AI/ }));
    expect(await screen.findByRole('button', { name: 'Tạo đề biến thể từ ảnh scan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo đề giống file gốc' })).not.toBeInTheDocument();
  });
});
