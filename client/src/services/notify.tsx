/**
 * notify — styled toast notifications using toast.custom().
 * Works reliably on iOS, Android, and desktop.
 * Usage: notify.error('msg')  notify.success('msg')  notify.warning('msg')  notify.info('msg')
 */
import React from 'react';
import toast from 'react-hot-toast';

type NotifyType = 'error' | 'success' | 'warning' | 'info';

const CONFIGS: Record<NotifyType, { iconBg: string; bg: string; border: string; icon: string }> = {
  error:   { iconBg: '#dc2626', bg: '#1a0505', border: '#7f1d1d', icon: '✕' },
  success: { iconBg: '#16a34a', bg: '#050f08', border: '#14532d', icon: '✓' },
  warning: { iconBg: '#d97706', bg: '#140e03', border: '#78350f', icon: '!' },
  info:    { iconBg: '#2563eb', bg: '#030a1a', border: '#1e3a8a', icon: 'i' },
};

function show(type: NotifyType, message: string, opts?: { duration?: number; id?: string }) {
  const cfg = CONFIGS[type];
  return toast.custom(
    (t) => (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: 12,
          padding: '10px 12px 10px 10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          minWidth: 220,
          maxWidth: 340,
          opacity: t.visible ? 1 : 0,
          transition: 'opacity 150ms ease',
          pointerEvents: 'auto',
        }}
      >
        {/* Colored icon square */}
        <div style={{
          background: cfg.iconBg,
          width: 30,
          height: 30,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
        }}>
          {cfg.icon}
        </div>

        {/* Message */}
        <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
          {message}
        </span>

        {/* Dismiss */}
        <button
          onClick={() => toast.dismiss(t.id)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 20,
            lineHeight: 1,
            padding: '0 2px',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    ),
    { duration: opts?.duration ?? 4000, id: opts?.id }
  );
}

export const notify = {
  error:   (msg: string, opts?: { duration?: number; id?: string }) => show('error', msg, opts),
  success: (msg: string, opts?: { duration?: number; id?: string }) => show('success', msg, opts),
  warning: (msg: string, opts?: { duration?: number; id?: string }) => show('warning', msg, opts),
  info:    (msg: string, opts?: { duration?: number; id?: string }) => show('info', msg, opts),
};
