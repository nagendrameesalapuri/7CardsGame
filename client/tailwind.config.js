/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Casino green table felt
        felt: {
          DEFAULT: '#1a5c38',
          dark: '#0f3d25',
          light: '#2a7a4e',
        },
        // Neon accent colours
        neon: {
          green: '#00ff88',
          blue: '#00bfff',
          purple: '#bf00ff',
          gold: '#ffd700',
          red: '#ff3b5c',
        },
        // Card colours
        card: {
          bg: '#f5f0e8',
          border: '#c8b89a',
        },
        // Theme-aware colours (switch via CSS variables in index.css)
        dark: {
          bg:      'var(--color-bg)',
          surface: 'var(--color-surface)',
          border:  'var(--color-border)',
          text:    'var(--color-text)',
          muted:   'var(--color-muted)',
        },
      },
      fontFamily: {
        game: ['"Exo 2"', 'sans-serif'],
        card: ['"Playfair Display"', 'serif'],
      },
      boxShadow: {
        'neon-green': '0 0 10px #00ff88, 0 0 30px #00ff8855',
        'neon-gold': '0 0 10px #ffd700, 0 0 30px #ffd70055',
        'neon-red': '0 0 10px #ff3b5c, 0 0 30px #ff3b5c55',
        'neon-blue': '0 0 10px #00bfff, 0 0 30px #00bfff55',
        'card': '0 4px 16px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.6)',
      },
      animation: {
        'card-deal': 'cardDeal 0.4s ease-out',
        'card-flip': 'cardFlip 0.5s ease-in-out',
        'pulse-neon': 'pulseNeon 2s infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'confetti': 'confetti 1s ease-out forwards',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.36,0.07,0.19,0.97)',
      },
      keyframes: {
        cardDeal: {
          '0%': { transform: 'translateY(-200px) rotate(-20deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
        },
        cardFlip: {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        pulseNeon: {
          '0%, 100%': { boxShadow: '0 0 5px #00ff88, 0 0 15px #00ff8844' },
          '50%': { boxShadow: '0 0 20px #00ff88, 0 0 60px #00ff8866' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      backgroundImage: {
        'felt-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
