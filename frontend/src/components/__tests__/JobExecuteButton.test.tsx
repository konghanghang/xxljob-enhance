import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobExecuteButton } from '../JobExecuteButton';
import { jobsApi } from '../../api/services';
import type { XxlJob } from '../../types/api';

// Mock the API
vi.mock('../../api/services', () => ({
  jobsApi: {
    trigger: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('JobExecuteButton', () => {
  const mockJob: XxlJob = {
    id: 1,
    jobGroup: 1,
    jobDesc: 'Test Job',
    author: 'admin',
    scheduleType: 'CRON',
    scheduleConf: '0 0 * * * ?',
    triggerStatus: 0,
    executorParam: 'default-param',
    executorHandler: 'testHandler',
    triggerLastTime: 0,
    triggerNextTime: 0,
  };

  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Trigger Button', () => {
    it('should render trigger button', () => {
      render(<JobExecuteButton job={mockJob} type="trigger" />);

      const button = screen.getByTestId('trigger-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Trigger');
    });

    it('should open modal when trigger button is clicked', async () => {
      const user = userEvent.setup();
      render(<JobExecuteButton job={mockJob} type="trigger" />);

      const button = screen.getByTestId('trigger-button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(`Trigger Job: ${mockJob.jobDesc}`)).toBeInTheDocument();
      });
    });

    it('should pre-fill executor param in modal', async () => {
      const user = userEvent.setup();
      render(<JobExecuteButton job={mockJob} type="trigger" />);

      await user.click(screen.getByTestId('trigger-button'));

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(
          'Enter executor parameter (optional)'
        ) as HTMLTextAreaElement;
        expect(textarea.value).toBe('default-param');
      });
    });

    it('should trigger job with parameters when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(jobsApi.trigger).mockResolvedValue({ data: {} } as any);

      render(<JobExecuteButton job={mockJob} type="trigger" onSuccess={mockOnSuccess} />);

      // Open modal
      await user.click(screen.getByTestId('trigger-button'));

      await waitFor(() => {
        expect(screen.getByText(`Trigger Job: ${mockJob.jobDesc}`)).toBeInTheDocument();
      });

      // Fill in parameters
      const paramInput = screen.getByPlaceholderText('Enter executor parameter (optional)');
      await user.clear(paramInput);
      await user.type(paramInput, 'custom-param');

      const addressInput = screen.getByPlaceholderText(
        'e.g., 192.168.1.1:9999,192.168.1.2:9999'
      );
      await user.type(addressInput, '127.0.0.1:9999');

      // Click trigger button in modal
      const triggerButton = screen.getByRole('button', { name: 'Trigger' });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(jobsApi.trigger).toHaveBeenCalledWith(1, {
          executorParam: 'custom-param',
          addressList: '127.0.0.1:9999',
        });
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should handle trigger API error', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Permission denied';
      vi.mocked(jobsApi.trigger).mockRejectedValue({
        response: { data: { message: errorMessage } },
      });

      render(<JobExecuteButton job={mockJob} type="trigger" />);

      await user.click(screen.getByTestId('trigger-button'));

      await waitFor(() => {
        expect(screen.getByText(`Trigger Job: ${mockJob.jobDesc}`)).toBeInTheDocument();
      });

      const triggerButton = screen.getByRole('button', { name: 'Trigger' });
      await user.click(triggerButton);

      await waitFor(() => {
        expect(jobsApi.trigger).toHaveBeenCalled();
      });
    });

    it('should close modal and reset form when cancelled', async () => {
      const user = userEvent.setup();
      render(<JobExecuteButton job={mockJob} type="trigger" />);

      await user.click(screen.getByTestId('trigger-button'));

      await waitFor(() => {
        expect(screen.getByText(`Trigger Job: ${mockJob.jobDesc}`)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      // Wait for modal to start closing (Ant Design uses animations)
      await waitFor(
        () => {
          const modalWrap = document.querySelector('.ant-modal-wrap');
          expect(modalWrap).toHaveStyle({ display: 'none' });
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Start Button', () => {
    it('should render start button', () => {
      render(<JobExecuteButton job={mockJob} type="start" />);

      const button = screen.getByTestId('start-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Start');
    });

    it('should start job when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(jobsApi.start).mockResolvedValue({ data: {} } as any);

      render(<JobExecuteButton job={mockJob} type="start" onSuccess={mockOnSuccess} />);

      const button = screen.getByTestId('start-button');
      await user.click(button);

      // Confirm in popconfirm
      const yesButton = screen.getByRole('button', { name: 'Yes' });
      await user.click(yesButton);

      await waitFor(() => {
        expect(jobsApi.start).toHaveBeenCalledWith(1);
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should handle start API error', async () => {
      const user = userEvent.setup();
      vi.mocked(jobsApi.start).mockRejectedValue({
        response: { data: { message: 'Permission denied' } },
      });

      render(<JobExecuteButton job={mockJob} type="start" />);

      await user.click(screen.getByTestId('start-button'));

      const yesButton = screen.getByRole('button', { name: 'Yes' });
      await user.click(yesButton);

      await waitFor(() => {
        expect(jobsApi.start).toHaveBeenCalled();
      });
    });
  });

  describe('Stop Button', () => {
    it('should render stop button', () => {
      render(<JobExecuteButton job={mockJob} type="stop" />);

      const button = screen.getByTestId('stop-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Stop');
    });

    it('should stop job when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(jobsApi.stop).mockResolvedValue({ data: {} } as any);

      render(<JobExecuteButton job={mockJob} type="stop" onSuccess={mockOnSuccess} />);

      const button = screen.getByTestId('stop-button');
      await user.click(button);

      const yesButton = screen.getByRole('button', { name: 'Yes' });
      await user.click(yesButton);

      await waitFor(() => {
        expect(jobsApi.stop).toHaveBeenCalledWith(1);
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should handle stop API error', async () => {
      const user = userEvent.setup();
      vi.mocked(jobsApi.stop).mockRejectedValue({
        response: { data: { message: 'Permission denied' } },
      });

      render(<JobExecuteButton job={mockJob} type="stop" />);

      await user.click(screen.getByTestId('stop-button'));

      const yesButton = screen.getByRole('button', { name: 'Yes' });
      await user.click(yesButton);

      await waitFor(() => {
        expect(jobsApi.stop).toHaveBeenCalled();
      });
    });
  });

  describe('Type Validation', () => {
    it('should return null for invalid type', () => {
      const { container } = render(
        <JobExecuteButton job={mockJob} type={'invalid' as any} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should default to trigger type when not specified', () => {
      render(<JobExecuteButton job={mockJob} />);

      const button = screen.getByTestId('trigger-button');
      expect(button).toBeInTheDocument();
    });
  });
});
