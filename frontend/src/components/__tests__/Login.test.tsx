import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import Login from '../Login'

const mockLogin = vi.fn()

const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      {children}
    </div>
  )
}

const renderWithMockAuth = (component: React.ReactNode, authContext = {}) => {
  return render(
    <MockAuthProvider>
      {component}
    </MockAuthProvider>
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders login form', () => {
    renderWithMockAuth(<Login />, { login: mockLogin })

    expect(screen.getByText('Sign in to Readur')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText("Don't have an account? Sign up")).toBeInTheDocument()
  })

  test('handles form submission with valid credentials', async () => {
    mockLogin.mockResolvedValue(undefined)

    renderWithMockAuth(<Login />, { login: mockLogin })

    const usernameInput = screen.getByPlaceholderText('Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign in' })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123')
    })
  })

  test('displays error message on login failure', async () => {
    const errorMessage = 'Invalid credentials'
    mockLogin.mockRejectedValue({
      response: { data: { message: errorMessage } },
    })

    renderWithMockAuth(<Login />, { login: mockLogin })

    const usernameInput = screen.getByPlaceholderText('Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign in' })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  test('shows loading state during submission', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {})) // Never resolves

    renderWithMockAuth(<Login />, { login: mockLogin })

    const usernameInput = screen.getByPlaceholderText('Username')
    const passwordInput = screen.getByPlaceholderText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign in' })

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })
  })

  test('requires username and password', () => {
    renderWithMockAuth(<Login />, { login: mockLogin })

    const usernameInput = screen.getByPlaceholderText('Username')
    const passwordInput = screen.getByPlaceholderText('Password')

    expect(usernameInput).toBeRequired()
    expect(passwordInput).toBeRequired()
  })
})