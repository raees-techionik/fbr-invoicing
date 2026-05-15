import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import OfflineQueue from './OfflineQueue';
import {
  getOfflineQueue,
  getOfflineQueueSummary,
  processOfflineQueue,
  retryOfflineQueueItem,
} from '../services/fbrOfflineQueueApi';

jest.mock('../Components/MainBell', () => function MainBellMock() {
  return <div data-testid="main-bell" />;
});

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}), { virtual: true });

jest.mock('react-toastify', () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('../services/fbrOfflineQueueApi', () => ({
  getOfflineQueue: jest.fn(),
  getOfflineQueueSummary: jest.fn(),
  processOfflineQueue: jest.fn(),
  retryOfflineQueueItem: jest.fn(),
}));

const now = Date.now();

function hoursAgo(hours) {
  return new Date(now - hours * 60 * 60 * 1000).toISOString();
}

function hoursFromNow(hours) {
  return new Date(now + hours * 60 * 60 * 1000).toISOString();
}

const queueItems = [
  {
    id: 'warning-id',
    status: 'PENDING',
    queuedAt: hoursAgo(21),
    warningAt: hoursAgo(1),
    uploadDeadlineAt: hoursFromNow(3),
    retryCount: 0,
    isUploadDeadlineWarning: true,
    isUploadDeadlineExpired: false,
    invoice: {
      invoiceRefNo: 'WARN-1',
      buyerBusinessName: 'Warning Buyer',
    },
  },
  {
    id: 'expired-id',
    status: 'PENDING',
    queuedAt: hoursAgo(25),
    warningAt: hoursAgo(5),
    uploadDeadlineAt: hoursAgo(1),
    retryCount: 0,
    isUploadDeadlineWarning: true,
    isUploadDeadlineExpired: true,
    invoice: {
      invoiceRefNo: 'EXP-1',
      buyerBusinessName: 'Expired Buyer',
    },
  },
  {
    id: 'failed-id',
    status: 'FAILED',
    queuedAt: hoursAgo(2),
    warningAt: hoursFromNow(18),
    uploadDeadlineAt: hoursFromNow(22),
    retryCount: 3,
    isUploadDeadlineWarning: false,
    isUploadDeadlineExpired: false,
    invoice: {
      invoiceRefNo: 'FAILED-1',
      buyerBusinessName: 'Failed Buyer',
    },
  },
  {
    id: 'uploaded-id',
    status: 'UPLOADED',
    queuedAt: hoursAgo(1),
    uploadedAt: new Date(now).toISOString(),
    warningAt: hoursFromNow(19),
    uploadDeadlineAt: hoursFromNow(23),
    retryCount: 1,
    isUploadDeadlineWarning: false,
    isUploadDeadlineExpired: false,
    invoice: {
      invoiceRefNo: 'UPLOADED-1',
      buyerBusinessName: 'Uploaded Buyer',
    },
  },
];

const summary = {
  offline: 2,
  pending: 2,
  upload_failed: 1,
  submitted: 1,
  warningCount: 1,
  expiredCount: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  getOfflineQueue.mockResolvedValue(queueItems);
  getOfflineQueueSummary.mockResolvedValue(summary);
  processOfflineQueue.mockResolvedValue({ processed: 1, uploaded: 1, failed: 0 });
  retryOfflineQueueItem.mockResolvedValue({ id: 'failed-id', status: 'UPLOADED' });
});

test('renders offline queue warning, expired, failed, and uploaded states', async () => {
  render(<OfflineQueue />);

  expect(await screen.findByText('WARN-1')).toBeInTheDocument();
  expect(screen.getByText('EXP-1')).toBeInTheDocument();
  expect(screen.getByText('FAILED-1')).toBeInTheDocument();
  expect(screen.getByText('UPLOADED-1')).toBeInTheDocument();

  expect(screen.getByText('20h warning')).toBeInTheDocument();
  expect(screen.getByText('24h deadline passed')).toBeInTheDocument();
  expect(screen.getByText('UPLOAD FAILED')).toBeInTheDocument();
  expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
  expect(screen.getByText(/1 offline invoice has passed the 24-hour upload deadline/i)).toBeInTheDocument();

  expect(screen.getAllByRole('button', { name: /retry/i })).toHaveLength(2);
});

test('processes pending offline queue items from the page', async () => {
  render(<OfflineQueue />);

  await screen.findByText('WARN-1');
  const processButton = await screen.findByRole('button', { name: /upload all pending/i });
  expect(processButton).not.toBeDisabled();

  await act(async () => {
    fireEvent.click(processButton);
  });

  await waitFor(() => {
    expect(processOfflineQueue).toHaveBeenCalledTimes(1);
  });
  expect(getOfflineQueue).toHaveBeenCalledTimes(2);
  expect(getOfflineQueueSummary).toHaveBeenCalledTimes(2);
});

test('retries a failed offline queue item from the row action', async () => {
  render(<OfflineQueue />);

  const failedCell = await screen.findByText('FAILED-1');
  const failedRow = failedCell.closest('tr');
  const retryButton = within(failedRow).getByRole('button', { name: /retry/i });

  fireEvent.click(retryButton);

  await waitFor(() => {
    expect(retryOfflineQueueItem).toHaveBeenCalledWith('failed-id');
  });
  expect(getOfflineQueue).toHaveBeenCalledTimes(2);
  expect(getOfflineQueueSummary).toHaveBeenCalledTimes(2);
});
