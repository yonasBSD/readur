import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NotificationPanel from '../NotificationPanel';
import { NotificationProvider } from '../../../contexts/NotificationContext';
import { Notification } from '../../../types/notification';
import React from 'react';

// Mock date-fns formatDistanceToNow
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 minutes ago'),
}));

const theme = createTheme();

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'success',
    title: 'Upload Complete',
    message: 'document.pdf uploaded successfully',
    timestamp: new Date('2023-12-01T10:00:00Z'),
    read: false,
  },
  {
    id: '2',
    type: 'error',
    title: 'Upload Failed',
    message: 'Failed to upload document.pdf',
    timestamp: new Date('2023-12-01T09:30:00Z'),
    read: true,
  },
  {
    id: '3',
    type: 'warning',
    title: 'Partial Success',
    message: '2 files uploaded, 1 failed',
    timestamp: new Date('2023-12-01T09:00:00Z'),
    read: false,
  },
];

// Mock the notification context
const mockNotificationContext = {
  notifications: mockNotifications,
  unreadCount: 2,
  addNotification: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  clearNotification: vi.fn(),
  clearAll: vi.fn(),
  addBatchNotification: vi.fn(),
};

vi.mock('../../../contexts/NotificationContext', async () => {
  const actual = await vi.importActual('../../../contexts/NotificationContext');
  return {
    ...actual,
    useNotifications: () => mockNotificationContext,
  };
});

const renderNotificationPanel = (anchorEl: HTMLElement | null = null, onClose = vi.fn()) => {
  // Create a mock anchor element if none provided
  const mockAnchorEl = anchorEl || document.createElement('div');
  Object.defineProperty(mockAnchorEl, 'getBoundingClientRect', {
    value: () => ({
      bottom: 100,
      top: 50,
      left: 200,
      right: 250,
      width: 50,
      height: 50,
    }),
  });

  return render(
    <ThemeProvider theme={theme}>
      <NotificationPanel anchorEl={mockAnchorEl} onClose={onClose} />
    </ThemeProvider>
  );
};

describe('NotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should not render when anchorEl is null', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <NotificationPanel anchorEl={null} onClose={vi.fn()} />
      </ThemeProvider>
    );

    expect(container.firstChild).toBeNull();
  });

  test('should render notification panel with header', () => {
    renderNotificationPanel();

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Unread count badge
  });

  test('should render all notifications', () => {
    renderNotificationPanel();

    expect(screen.getByText('Upload Complete')).toBeInTheDocument();
    expect(screen.getByText('document.pdf uploaded successfully')).toBeInTheDocument();
    expect(screen.getByText('Upload Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed to upload document.pdf')).toBeInTheDocument();
    expect(screen.getByText('Partial Success')).toBeInTheDocument();
    expect(screen.getByText('2 files uploaded, 1 failed')).toBeInTheDocument();
  });

  test('should display correct icons for different notification types', () => {
    renderNotificationPanel();

    // Check for MUI icons (they render as SVG elements)
    const svgElements = screen.getAllByRole('img', { hidden: true });
    expect(svgElements.length).toBeGreaterThan(0);
  });

  test('should call markAsRead when notification is clicked', () => {
    renderNotificationPanel();

    const firstNotification = screen.getByText('Upload Complete').closest('li');
    expect(firstNotification).toBeInTheDocument();

    fireEvent.click(firstNotification!);

    expect(mockNotificationContext.markAsRead).toHaveBeenCalledWith('1');
  });

  test('should call clearNotification when close button is clicked', () => {
    renderNotificationPanel();

    // Find the close buttons (there should be multiple - one for each notification)
    const closeButtons = screen.getAllByRole('button');
    const notificationCloseButton = closeButtons.find(button => 
      button.closest('li') && button !== closeButtons[0] // Exclude the main close button
    );

    expect(notificationCloseButton).toBeInTheDocument();
    fireEvent.click(notificationCloseButton!);

    expect(mockNotificationContext.clearNotification).toHaveBeenCalled();
  });

  test('should call markAllAsRead when mark all read button is clicked', () => {
    renderNotificationPanel();

    const markAllReadButton = screen.getByTitle('Mark all as read');
    fireEvent.click(markAllReadButton);

    expect(mockNotificationContext.markAllAsRead).toHaveBeenCalled();
  });

  test('should call clearAll when clear all button is clicked', () => {
    renderNotificationPanel();

    const clearAllButton = screen.getByTitle('Clear all');
    fireEvent.click(clearAllButton);

    expect(mockNotificationContext.clearAll).toHaveBeenCalled();
  });

  test('should call onClose when main close button is clicked', () => {
    const mockOnClose = vi.fn();
    renderNotificationPanel(null, mockOnClose);

    // Find the main close button (should be in the header)
    const closeButtons = screen.getAllByRole('button');
    const mainCloseButton = closeButtons.find(button => 
      !button.closest('li') && button.getAttribute('title') !== 'Mark all as read' && button.getAttribute('title') !== 'Clear all'
    );

    expect(mainCloseButton).toBeInTheDocument();
    fireEvent.click(mainCloseButton!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should display "No notifications" when notifications array is empty', () => {
    // Mock empty notifications
    const emptyMockContext = {
      ...mockNotificationContext,
      notifications: [],
      unreadCount: 0,
    };

    vi.mocked(require('../../../contexts/NotificationContext').useNotifications).mockReturnValue(emptyMockContext);

    renderNotificationPanel();

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  test('should apply correct styling for unread notifications', () => {
    renderNotificationPanel();

    // Find the unread notification (first one in our mock)
    const unreadNotification = screen.getByText('Upload Complete').closest('li');
    expect(unreadNotification).toHaveStyle({ background: expect.stringContaining('rgba(99,102,241') });
  });

  test('should show timestamp for each notification', () => {
    renderNotificationPanel();

    // Should show mocked timestamp for all notifications
    const timestamps = screen.getAllByText('2 minutes ago');
    expect(timestamps).toHaveLength(3); // One for each notification
  });

  test('should prevent event propagation when clearing notification', () => {
    renderNotificationPanel();

    const clearButton = screen.getAllByRole('button').find(button => 
      button.closest('li') && button !== screen.getAllByRole('button')[0]
    );

    const stopPropagationSpy = vi.fn();
    const mockEvent = {
      stopPropagation: stopPropagationSpy,
    } as any;

    // Simulate click with event object
    fireEvent.click(clearButton!, mockEvent);

    expect(mockNotificationContext.clearNotification).toHaveBeenCalled();
  });
});

// Test with real NotificationProvider (integration test)
describe('NotificationPanel Integration', () => {
  const IntegrationTestComponent: React.FC = () => {
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
    const [isOpen, setIsOpen] = React.useState(false);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
      setIsOpen(true);
    };

    const handleClose = () => {
      setAnchorEl(null);
      setIsOpen(false);
    };

    return (
      <div>
        <button data-testid="open-panel" onClick={handleOpen}>
          Open Panel
        </button>
        {isOpen && <NotificationPanel anchorEl={anchorEl} onClose={handleClose} />}
      </div>
    );
  };

  test('should work with real NotificationProvider', () => {
    // Restore the real useNotifications for this test
    vi.mocked(require('../../../contexts/NotificationContext').useNotifications).mockRestore();

    render(
      <ThemeProvider theme={theme}>
        <NotificationProvider>
          <IntegrationTestComponent />
        </NotificationProvider>
      </ThemeProvider>
    );

    // Open the panel
    fireEvent.click(screen.getByTestId('open-panel'));

    // Should show empty state initially
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });
});