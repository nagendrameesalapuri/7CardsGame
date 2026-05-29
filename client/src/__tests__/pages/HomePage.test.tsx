import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...(actual as any), useNavigate: () => mockNavigate };
});

const mockGuestLogin = vi.fn();
const mockGoogleLogin = vi.fn();

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock the Button component to be a plain button (avoids CSS class issues in jsdom)
vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, loading }: any) => (
    <button onClick={onClick} disabled={disabled || loading}>
      {children}
    </button>
  ),
}));

import { HomePage } from '../../pages/HomePage';
import { useAuthStore } from '../../store/authStore';

function renderPage(overrides: Partial<ReturnType<typeof useAuthStore>> = {}) {
  (useAuthStore as any).mockReturnValue({
    isAuthenticated: false,
    guestLogin: mockGuestLogin,
    googleLogin: mockGoogleLogin,
    isLoading: false,
    ...overrides,
  });

  // Ensure window.location.search is empty
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { search: '', href: 'http://localhost/' },
  });

  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the game title', () => {
    renderPage();
    expect(screen.getByText('Arena of Sevens')).toBeInTheDocument();
  });

  it('renders the Google login button', () => {
    renderPage();
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
  });

  it('renders the Play as Guest button', () => {
    renderPage();
    expect(screen.getByText(/Play as Guest/i)).toBeInTheDocument();
  });

  it('renders feature chips', () => {
    renderPage();
    expect(screen.getByText('AI Opponents')).toBeInTheDocument();
    expect(screen.getByText('Real-time PvP')).toBeInTheDocument();
  });

  it('shows guest name input form after clicking Play as Guest', () => {
    renderPage();
    fireEvent.click(screen.getByText(/Play as Guest/i));
    expect(screen.getByPlaceholderText('Your display name')).toBeInTheDocument();
    expect(screen.getByText('Enter the Arena')).toBeInTheDocument();
  });

  it('shows error for names shorter than 2 characters on Enter key', async () => {
    renderPage();
    fireEvent.click(screen.getByText(/Play as Guest/i));
    const input = screen.getByPlaceholderText('Your display name');
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
    });
  });

  it('Enter the Arena button is disabled for names shorter than 2 chars', () => {
    renderPage();
    fireEvent.click(screen.getByText(/Play as Guest/i));
    fireEvent.change(screen.getByPlaceholderText('Your display name'), {
      target: { value: 'X' },
    });
    expect(screen.getByText('Enter the Arena').closest('button')).toBeDisabled();
  });

  it('Enter the Arena button is enabled for names of 2+ characters', () => {
    renderPage();
    fireEvent.click(screen.getByText(/Play as Guest/i));
    fireEvent.change(screen.getByPlaceholderText('Your display name'), {
      target: { value: 'Jo' },
    });
    expect(screen.getByText('Enter the Arena').closest('button')).not.toBeDisabled();
  });

  it('navigates to /admin/login when username is ADMIN', async () => {
    renderPage();
    fireEvent.click(screen.getByText(/Play as Guest/i));
    fireEvent.change(screen.getByPlaceholderText('Your display name'), {
      target: { value: 'ADMIN' },
    });
    fireEvent.click(screen.getByText('Enter the Arena'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/login');
    expect(mockGuestLogin).not.toHaveBeenCalled();
  });

  it('calls guestLogin and navigates to /lobby on success', async () => {
    mockGuestLogin.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(screen.getByText(/Play as Guest/i));
    fireEvent.change(screen.getByPlaceholderText('Your display name'), {
      target: { value: 'Arena Player' },
    });
    fireEvent.click(screen.getByText('Enter the Arena'));

    await waitFor(() => {
      expect(mockGuestLogin).toHaveBeenCalledWith('Arena Player');
      expect(mockNavigate).toHaveBeenCalledWith('/lobby');
    });
  });

  it('shows error message when guestLogin rejects', async () => {
    mockGuestLogin.mockRejectedValue(new Error('Username already in use'));
    renderPage();

    fireEvent.click(screen.getByText(/Play as Guest/i));
    fireEvent.change(screen.getByPlaceholderText('Your display name'), {
      target: { value: 'TakenName' },
    });
    fireEvent.click(screen.getByText('Enter the Arena'));

    await waitFor(() => {
      expect(screen.getByText('Username already in use')).toBeInTheDocument();
    });
  });

  it('back button returns to main view', () => {
    renderPage();
    fireEvent.click(screen.getByText(/Play as Guest/i));
    expect(screen.getByPlaceholderText('Your display name')).toBeInTheDocument();
    fireEvent.click(screen.getByText('← Back'));
    expect(screen.queryByPlaceholderText('Your display name')).not.toBeInTheDocument();
  });

  it('redirects to /lobby when already authenticated', () => {
    renderPage({ isAuthenticated: true });
    expect(mockNavigate).toHaveBeenCalledWith('/lobby');
  });

  it('calls googleLogin when Google button is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByText(/Continue with Google/i));
    expect(mockGoogleLogin).toHaveBeenCalled();
  });

  it('clears guest error when user starts typing again', async () => {
    mockGuestLogin.mockRejectedValue(new Error('Login failed'));
    renderPage();

    fireEvent.click(screen.getByText(/Play as Guest/i));
    const input = screen.getByPlaceholderText('Your display name');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Enter the Arena'));

    await waitFor(() => screen.getByText('Login failed'));

    fireEvent.change(input, { target: { value: 'Test2' } });
    expect(screen.queryByText('Login failed')).not.toBeInTheDocument();
  });
});
