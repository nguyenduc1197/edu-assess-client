import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ForceChangePasswordPage, { MUST_CHANGE_PASSWORD_KEY } from './ForceChangePasswordPage';
import { fetchClient } from '../../../api/fetchClient';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));
const mockedFetch = fetchClient as jest.Mock;

function fill(current: string, next: string, confirm = next) {
  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('Mật khẩu mới (ít nhất 6 ký tự)'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: confirm } });
  fireEvent.click(screen.getByText('Đổi mật khẩu và tiếp tục'));
}

beforeEach(() => {
  mockedFetch.mockReset();
  localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, '1');
});

test('rejects reusing the current password without calling the API', () => {
  render(<ForceChangePasswordPage onChanged={jest.fn()} onLogout={jest.fn()} />);
  fill('123456', '123456');
  expect(screen.getByText('Mật khẩu mới phải khác mật khẩu hiện tại.')).toBeInTheDocument();
  expect(mockedFetch).not.toHaveBeenCalled();
});

test('successful change clears the flag and continues', async () => {
  mockedFetch.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
  const onChanged = jest.fn();
  render(<ForceChangePasswordPage onChanged={onChanged} onLogout={jest.fn()} />);
  fill('123456', 'matkhaumoi');

  await waitFor(() => expect(onChanged).toHaveBeenCalled());
  expect(localStorage.getItem(MUST_CHANGE_PASSWORD_KEY)).toBeNull();
  expect(JSON.parse(mockedFetch.mock.calls[0][1].body)).toEqual({ currentPassword: '123456', newPassword: 'matkhaumoi' });
});

test('wrong current password keeps the user on the page', async () => {
  mockedFetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'Mật khẩu hiện tại không đúng.' }) });
  const onChanged = jest.fn();
  render(<ForceChangePasswordPage onChanged={onChanged} onLogout={jest.fn()} />);
  fill('sai', 'matkhaumoi');

  await screen.findByText('Mật khẩu hiện tại không đúng.');
  expect(onChanged).not.toHaveBeenCalled();
  expect(localStorage.getItem(MUST_CHANGE_PASSWORD_KEY)).toBe('1');
});
