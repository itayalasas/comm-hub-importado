import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { configManager } from './lib/config';

const root = ReactDOM.createRoot(document.getElementById('root')!);

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#020c1b',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      gap: '32px',
    }}>
      {/* Logo */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '18px',
          border: '1px solid rgba(34,211,238,0.2)',
          animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
        }} />
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, #22d3ee 0%, #2563eb 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 40px rgba(34,211,238,0.25)',
          position: 'relative',
        }}>
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <rect x="5" y="8" width="22" height="16" rx="3" stroke="white" strokeWidth="2"/>
            <path d="M6 11L16 18.5L26 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21.7 3.5L22.5 5.3L24.3 6.1L22.5 6.9L21.7 8.7L20.9 6.9L19.1 6.1L20.9 5.3L21.7 3.5Z" fill="#BAE6FD"/>
          </svg>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '180px',
        height: '2px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '999px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: '40%',
          background: 'linear-gradient(90deg, #22d3ee, #2563eb)',
          borderRadius: '999px',
          animation: 'slide 1.4s ease-in-out infinite',
        }} />
      </div>

      <p style={{ color: '#334155', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
        SendCraft
      </p>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes slide {
          0%   { transform: translateX(-250%); }
          100% { transform: translateX(600%); }
        }
      `}</style>
    </div>
  );
}

function ErrorScreen({ error }: { error: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#020c1b',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '40px 32px',
        borderRadius: '16px',
      }}>
        <div style={{
          width: '52px',
          height: '52px',
          backgroundColor: 'rgba(239,68,68,0.1)',
          color: '#ef4444',
          borderRadius: '14px',
          border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '22px',
          fontWeight: 'bold'
        }}>!</div>
        <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
          Error al iniciar
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'linear-gradient(135deg, #22d3ee, #2563eb)',
            color: '#fff',
            border: 'none',
            padding: '10px 24px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            letterSpacing: '0.01em',
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

root.render(<LoadingScreen />);

configManager.loadConfig()
  .then(() => {
    console.log('[App] Configuration loaded successfully');
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch((error) => {
    console.error('[App] Failed to load configuration:', error);
    root.render(<ErrorScreen error={error.message || 'Error desconocido'} />);
  });
