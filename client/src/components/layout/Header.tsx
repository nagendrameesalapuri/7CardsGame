import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { ThemeToggle } from '../ui/ThemeToggle';

export function Header() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  return (
    <header className="bg-dark-surface/90 backdrop-blur-md border-b border-dark-border sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-dark-text hover:text-neon-green transition-colors">
          <span className="text-2xl">🃏</span>
          <span className="font-game">7 Cards Show</span>
        </Link>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-6 text-sm text-dark-muted">
          <Link to="/lobby" className="hover:text-dark-text transition-colors">Play</Link>
          <Link to="/leaderboard" className="hover:text-dark-text transition-colors">Leaderboard</Link>
          <Link to="/profile" className="hover:text-dark-text transition-colors">Profile</Link>
        </nav>

        {/* Right: theme + user */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/profile')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar avatar={user.avatar} size="sm" />
                <span className="hidden sm:block text-sm text-dark-text font-medium max-w-[100px] truncate">
                  {user.username}
                </span>
              </button>
              <button
                onClick={logout}
                className="text-xs text-dark-muted hover:text-neon-red transition-colors px-2 py-1 rounded"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/"
              className="px-4 py-1.5 bg-neon-green text-dark-bg rounded-lg text-sm font-bold hover:bg-green-400 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
