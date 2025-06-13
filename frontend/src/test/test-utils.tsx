import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'

interface User {
  id: string
  username: string
  email: string
}

interface MockAuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
}

// Create a mock AuthProvider for testing
export const MockAuthProvider = ({ 
  children, 
  mockValues = {} 
}: { 
  children: React.ReactNode
  mockValues?: Partial<MockAuthContextType>
}) => {
  const defaultMocks = {
    user: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...mockValues
  }

  // Mock the useAuth hook
  const AuthContext = React.createContext(defaultMocks)
  
  return (
    <AuthContext.Provider value={defaultMocks}>
      {children}
    </AuthContext.Provider>
  )
}

// Create a custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <MockAuthProvider>
        {children}
      </MockAuthProvider>
    </BrowserRouter>
  )
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export const renderWithMockAuth = (
  ui: React.ReactElement,
  mockAuthValues?: Partial<MockAuthContextType>,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <MockAuthProvider mockValues={mockAuthValues}>
        {children}
      </MockAuthProvider>
    </BrowserRouter>
  )
  
  return render(ui, { wrapper: Wrapper, ...options })
}

// re-export everything
export * from '@testing-library/react'