import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TeacherDashboard from './TeacherDashboard';
import { fetchClient } from '../../../api/fetchClient';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
  getCurrentUserId: jest.fn(() => null),
  decodeJwtPayload: jest.fn(() => null),
}));
const mockedFetch = fetchClient as jest.Mock;
const json = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

// Round 7: "Tạo đề giống file gốc" lives inside Tạo Mới -> Tạo câu hỏi bằng AI; no separate button on the page.
describe('TeacherDashboard scan exam placement', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedFetch.mockImplementation((url: string) => {
      if (url.startsWith('/exams?')) return json({ items: [], totalCount: 0, totalPages: 1 });
      if (url.startsWith('/exams/deleted')) return json({ items: [], totalCount: 0, totalPages: 1 });
      if (url.startsWith('/classes')) return json({ items: [] });
      if (url === '/questions/competency-types') return json([{ value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' }]);
      return json([]);
    });
  });

  it('has no outside "Tạo đề thi từ file" button; the tab is reachable from Tạo Mới', async () => {
    render(<TeacherDashboard onLogout={jest.fn()} />);
    const createButton = await screen.findByRole('button', { name: /Tạo Mới/ });
    expect(screen.queryByRole('button', { name: /Tạo đề thi từ file/ })).not.toBeInTheDocument();

    fireEvent.click(createButton);
    fireEvent.click(await screen.findByRole('button', { name: /Tạo câu hỏi bằng AI/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo đề giống file gốc' }));
    expect(await screen.findByTestId('scan-exam-flow')).toBeInTheDocument();
  });
});
