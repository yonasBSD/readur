import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NotificationPanel from '../NotificationPanel';
import { NotificationProvider } from '../../../contexts/NotificationContext';
import React from 'react';

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 minutes ago'),
}));

const theme = createTheme();

const createMockAnchorEl = () => {
  const mockEl = document.createElement('div');
  Object.defineProperty(mockEl, 'getBoundingClientRect', {
    value: () => ({
      bottom: 100,
      top: 50,
      left: 200,
      right: 250,
      width: 50,
      height: 50,
    }),
  });
  return mockEl;
};

describe('NotificationPanel - Simple Tests', () => {
  test('should not render when anchorEl is null', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <NotificationProvider>
          <NotificationPanel anchorEl={null} onClose={vi.fn()} />
        </NotificationProvider>
      </ThemeProvider>
    );

    expect(container.firstChild).toBeNull();
  });

  test('should render notification panel with header when anchorEl is provided', () => {
    const mockAnchorEl = createMockAnchorEl();

    render(
      <ThemeProvider theme={theme}>
        <NotificationProvider>
          <NotificationPanel anchorEl={mockAnchorEl} onClose={vi.fn()} />
        </NotificationProvider>
      </ThemeProvider>
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  test('should show empty state when no notifications', () => {
    const mockAnchorEl = createMockAnchorEl();

    render(
      <ThemeProvider theme={theme}>
        <NotificationProvider>
          <NotificationPanel anchorEl={mockAnchorEl} onClose={vi.fn()} />
        </NotificationProvider>
      </ThemeProvider>
    );

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  test('should render with theme provider correctly', () => {
    const mockAnchorEl = createMockAnchorEl();

    const { container } = render(
      <ThemeProvider theme={theme}>
        <NotificationProvider>
          <NotificationPanel anchorEl={mockAnchorEl} onClose={vi.fn()} />
        </NotificationProvider>
      </ThemeProvider>
    );

    // Should render without crashing
    expect(container.firstChild).toBeTruthy();
  });
});