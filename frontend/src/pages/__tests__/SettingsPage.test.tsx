import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import SettingsPage from '../SettingsPage';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  }
}));

const mockUser = {
  id: '123',
  username: 'testuser',
  email: 'test@example.com',
};

const mockUsers = [
  {
    id: '123',
    username: 'testuser',
    email: 'test@example.com',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '456',
    username: 'anotheruser',
    email: 'another@example.com',
    created_at: '2024-01-02T00:00:00Z',
  },
];

const mockSettings = {
  ocr_language: 'eng',
};

const renderWithAuth = (component) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={{ user: mockUser, loading: false }}>
        {component}
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/settings') {
        return Promise.resolve({ data: mockSettings });
      }
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  test('renders settings page with tabs', async () => {
    renderWithAuth(<SettingsPage />);
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('User Management')).toBeInTheDocument();
  });

  test('displays OCR language settings', async () => {
    renderWithAuth(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('OCR Configuration')).toBeInTheDocument();
      expect(screen.getByLabelText('OCR Language')).toBeInTheDocument();
    });
  });

  test('changes OCR language setting', async () => {
    api.put.mockResolvedValueOnce({ data: { ocr_language: 'spa' } });
    
    renderWithAuth(<SettingsPage />);
    
    await waitFor(() => {
      const select = screen.getByLabelText('OCR Language');
      expect(select).toBeInTheDocument();
    });

    const select = screen.getByLabelText('OCR Language');
    fireEvent.mouseDown(select);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Spanish'));
    });

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/settings', { ocr_language: 'spa' });
    });
  });

  test('displays user management tab', async () => {
    renderWithAuth(<SettingsPage />);
    
    fireEvent.click(screen.getByText('User Management'));
    
    await waitFor(() => {
      expect(screen.getByText('Add User')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('anotheruser')).toBeInTheDocument();
    });
  });

  test('opens create user dialog', async () => {
    renderWithAuth(<SettingsPage />);
    
    fireEvent.click(screen.getByText('User Management'));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Add User'));
    });

    expect(screen.getByText('Create New User')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  test('creates a new user', async () => {
    api.post.mockResolvedValueOnce({ data: { id: '789', username: 'newuser', email: 'new@example.com' } });
    api.get.mockImplementation((url) => {
      if (url === '/settings') {
        return Promise.resolve({ data: mockSettings });
      }
      if (url === '/users') {
        return Promise.resolve({ data: [...mockUsers, { id: '789', username: 'newuser', email: 'new@example.com', created_at: '2024-01-03T00:00:00Z' }] });
      }
      return Promise.reject(new Error('Not found'));
    });
    
    renderWithAuth(<SettingsPage />);
    
    fireEvent.click(screen.getByText('User Management'));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Add User'));
    });

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/users', {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      });
    });
  });

  test('prevents deleting own user account', async () => {
    window.confirm = vi.fn(() => true);
    
    renderWithAuth(<SettingsPage />);
    
    fireEvent.click(screen.getByText('User Management'));
    
    await waitFor(() => {
      const deleteButtons = screen.getAllByTestId('DeleteIcon');
      expect(deleteButtons[0]).toBeDisabled(); // First user is the current user
    });
  });

  test('deletes another user', async () => {
    window.confirm = vi.fn(() => true);
    api.delete.mockResolvedValueOnce({});
    
    renderWithAuth(<SettingsPage />);
    
    fireEvent.click(screen.getByText('User Management'));
    
    await waitFor(() => {
      const deleteButtons = screen.getAllByTestId('DeleteIcon');
      fireEvent.click(deleteButtons[1]); // Delete the second user
    });

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this user?');
      expect(api.delete).toHaveBeenCalledWith('/users/456');
    });
  });

  test('handles API errors gracefully', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/settings') {
        return Promise.reject({ response: { status: 500 } });
      }
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      return Promise.reject(new Error('Not found'));
    });
    
    renderWithAuth(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });
});