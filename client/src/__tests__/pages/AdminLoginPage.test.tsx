import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...(actual as any), useNavigate: () => mockNavigate };
});

vi.mock('../../services/api', () => ({
  admin: { login: vi.fn() },
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({ user: null, token: null }),
}));

import { AdminLoginPage } from '../../pages/AdminLoginPage';
import { admin } from '../../services/api';

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminLoginPage />
    </MemoryRouter>
  );
}

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the admin login heading', () => {
    renderPage();
    expect(screen.getByText('Admin Access')).toBeInTheDocument();
  });

  it('renders the password input', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
  });

  it('Continue button is disabled when password is empty', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('Continue button is enabled after typing a password', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'mypassword' },
    });
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
  });

  it('shows error message on wrong password', async () => {
    (admin.login as any).mockRejectedValue({
      response: { data: { error: 'Invalid admin password' } },
    });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid admin password')).toBeInTheDocument();
    });
  });

  it('transitions to 2FA step when server returns requires2FA', async () => {
    (admin.login as any).mockRejectedValue({
      response: { data: { requires2FA: true } },
    });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'correctpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Auth')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });
  });

  it('Verify Code button is disabled with fewer than 6 digits', async () => {
    (admin.login as any).mockRejectedValue({
      response: { data: { requires2FA: true } },
    });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => screen.getByPlaceholderText('000000'));

    fireEvent.change(screen.getByPlaceholderText('000000'), {
      target: { value: '12345' },
    });
    expect(screen.getByRole('button', { name: /verify code/i })).toBeDisabled();
  });

  it('navigates to /admin on successful login', async () => {
    (admin.login as any).mockResolvedValue({ data: { token: 'admin-jwt-token' } });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'correct-pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(localStorage.getItem('adminToken')).toBe('admin-jwt-token');
      expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
    });
  });

  it('auto-redirects to /admin if adminToken already in localStorage', () => {
    localStorage.setItem('adminToken', 'existing-valid-token');
    renderPage();
    expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
  });

  it('back to game link navigates to /', () => {
    renderPage();
    fireEvent.click(screen.getByText(/Back to Game/i));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
