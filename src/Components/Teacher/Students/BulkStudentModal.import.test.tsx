import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BulkStudentModal from './BulkStudentModal';
import { fetchClient } from '../../../api/fetchClient';
import { downloadFile } from '../../../utils/downloadFile';

jest.mock('../../../api/fetchClient', () => ({
  fetchClient: jest.fn(),
}));
jest.mock('../../../utils/downloadFile', () => ({
  downloadFile: jest.fn(() => Promise.resolve()),
}));
const mockedFetch = fetchClient as jest.Mock;
const mockedDownload = downloadFile as jest.Mock;

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });

const parseResult = {
  rows: [
    { rowNumber: 2, name: 'Nguyễn Văn An', dateOfBirth: '2009-05-03T00:00:00', username: null, password: null },
    { rowNumber: 3, name: 'Trần Bình', dateOfBirth: null, username: 'binh01', password: '654321' },
  ],
  errors: [
    { rowNumber: 3, message: "Ngày sinh '31/02/2009' không hợp lệ (dùng dd/MM/yyyy)." },
    { rowNumber: 5, message: 'Thiếu họ tên.' },
  ],
};

const accounts = [
  { studentId: 's1', name: 'Nguyễn Văn An', username: 'an.nv', password: '123456' },
  { studentId: 's2', name: 'Trần Bình', username: 'binh01', password: '654321' },
];

function setup() {
  mockedFetch.mockImplementation((url: string) => {
    if (url.startsWith('/classes')) return ok([{ id: 'c1', name: '10A1' }]);
    if (url === '/students/import/parse') return ok(parseResult);
    if (url === '/students/bulk') return ok({ count: 2, studentIds: ['s1', 's2'], accounts });
    throw new Error(`unexpected ${url}`);
  });
  const onSuccess = jest.fn();
  const onClose = jest.fn();
  render(<BulkStudentModal onClose={onClose} onSuccess={onSuccess} />);
  return { onSuccess, onClose };
}

async function importFile() {
  const file = new File(['x'], 'ds.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  fireEvent.change(screen.getByTestId('excel-file-input'), { target: { files: [file] } });
  await screen.findByDisplayValue('Nguyễn Văn An');
}

beforeEach(() => {
  mockedFetch.mockReset();
  mockedDownload.mockClear();
});

test('downloads the template', async () => {
  setup();
  fireEvent.click(screen.getByText('Tải file mẫu'));
  await waitFor(() => expect(mockedDownload).toHaveBeenCalledWith('/students/import/template', 'mau-danh-sach-hoc-sinh.xlsx'));
});

test('imported rows fill the grid, replace the blank row and show file errors', async () => {
  setup();
  await importFile();

  const parseCall = mockedFetch.mock.calls.find(c => c[0] === '/students/import/parse');
  expect(parseCall[1].method).toBe('POST');
  expect(parseCall[1].body).toBeInstanceOf(FormData);

  expect(screen.getByDisplayValue('2009-05-03')).toBeInTheDocument();
  expect(screen.getByDisplayValue('binh01')).toBeInTheDocument();
  expect(screen.getByText(/Dòng 3 trong file: Ngày sinh/)).toBeInTheDocument();
  expect(screen.getByText('Dòng 5 trong file: Thiếu họ tên.')).toBeInTheDocument();
  expect(screen.getByText('2 học sinh')).toBeInTheDocument();
});

test('submits imported rows, then shows accounts and downloads the account list', async () => {
  const { onSuccess } = setup();
  await screen.findByText('10A1');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } });
  await importFile();

  fireEvent.click(screen.getByText('Thêm Tất Cả'));
  await screen.findByText('an.nv');

  const bulkCall = mockedFetch.mock.calls.find(c => c[0] === '/students/bulk');
  expect(JSON.parse(bulkCall[1].body)).toEqual({
    schoolClassId: 'c1',
    students: [
      { name: 'Nguyễn Văn An', dateOfBirth: '2009-05-03T00:00:00', username: null, password: null },
      { name: 'Trần Bình', dateOfBirth: null, username: 'binh01', password: '654321' },
    ],
  });
  expect(onSuccess).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByText('Tải danh sách tài khoản (.xlsx)'));
  await waitFor(() => expect(mockedDownload).toHaveBeenCalled());
  const [endpoint, , options] = mockedDownload.mock.calls[0];
  expect(endpoint).toBe('/students/import/accounts-file');
  expect(JSON.parse(options.body)).toEqual({ className: '10A1', accounts });
});
