import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import Login from '../Login'

// Mock the auth context
const mockLogin = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    loading: false,
    register: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}))

// Mock the API service
vi.mock('../../services/api', () => ({
  api: {
    defaults: { headers: { common: {} } },
    get: vi.fn(),
    post: vi.fn(),
  },
}))

const LoginWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
)

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders login form', () => {
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    expect(screen.getByText('Sign in to Readur')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText("Don't have an account? Sign up")).toBeInTheDocument()
  })

  test('handles form submission with valid credentials', async () => {
    mockLogin.mockResolvedValue(undefined)

    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

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

    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

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

    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

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
    render(
      <LoginWrapper>
        <Login />
      </LoginWrapper>
    )

    const usernameInput = screen.getByPlaceholderText('Username')
    const passwordInput = screen.getByPlaceholderText('Password')

    expect(usernameInput).toBeRequired()
    expect(passwordInput).toBeRequired()
  })
})