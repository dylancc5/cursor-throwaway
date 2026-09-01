'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Bot, CheckCircle2, Loader2, LogIn, Sparkles } from 'lucide-react';

interface LoginButtonProps {
  onLoginSuccess?: (email: string) => void;
  className?: string;
  showMockOption?: boolean;
}

export function LoginButton({
  onLoginSuccess,
  className,
  showMockOption = true,
}: LoginButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleCursorLogin = async () => {
    setIsLoading(true);
    setStatusMessage('Contacting Cursor auth bridge...');

    try {
      // Step 1: Request login session from API
      const res = await apiClient.login();
      const { sessionId, loginUrl } = res;

      // Step 2: Open popup window
      setStatusMessage('Waiting for Cursor authorization...');
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        loginUrl,
        'CursorLoginPopup',
        `width=${width},height=${height},top=${top},left=${left},status=no,toolbar=no,menubar=no`
      );

      // Step 3: Poll /auth/status/:sessionId every 1.5s
      const pollInterval = setInterval(async () => {
        try {
          const authStatus = await apiClient.getAuthStatus(sessionId);
          if (authStatus.status === 'logged-in') {
            clearInterval(pollInterval);
            if (popup && !popup.closed) popup.close();
            setIsLoading(false);
            setStatusMessage('Authenticated successfully!');
            localStorage.setItem('cursor_session_id', sessionId);
            localStorage.setItem('cursor_user_email', authStatus.email || 'user@cursor.com');
            localStorage.setItem('cursor_is_mock', 'false');

            if (onLoginSuccess) {
              onLoginSuccess(authStatus.email || 'user@cursor.com');
            } else {
              router.push('/burn');
            }
          } else if (authStatus.status === 'expired' || authStatus.status === 'error') {
            clearInterval(pollInterval);
            setIsLoading(false);
            setStatusMessage(
              ('message' in authStatus && authStatus.message) || 'Auth expired. Try again.',
            );
          }
        } catch {
          // If popup was closed by user
          if (popup && popup.closed) {
            clearInterval(pollInterval);
            setIsLoading(false);
            setStatusMessage('Login cancelled');
          }
        }
      }, 1500);

      // Timeout after 3 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isLoading) {
          setIsLoading(false);
          setStatusMessage('Login timed out');
        }
      }, 180000);
    } catch (err: any) {
      console.warn('API login endpoint unreachable, offering mock mode:', err.message);
      setStatusMessage('Backend not running on :3001. Launching in Simulation Mode...');
      setTimeout(() => {
        handleMockLogin();
      }, 800);
    }
  };

  const handleMockLogin = () => {
    localStorage.setItem('cursor_session_id', 'mock-session-pro');
    localStorage.setItem('cursor_user_email', 'pro-engineer@company.com');
    localStorage.setItem('cursor_is_mock', 'true');
    router.push('/burn');
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCursorLogin}
          disabled={isLoading}
          className={`flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 px-6 py-3.5 font-mono text-sm font-bold tracking-wide text-white shadow-[0_0_25px_rgba(6,182,212,0.45)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 ${
            className || ''
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          <span>{isLoading ? 'Connecting Cursor...' : 'Connect Cursor Account'}</span>
        </button>

        {showMockOption && (
          <button
            onClick={handleMockLogin}
            className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 px-5 py-3.5 font-mono text-xs font-semibold text-slate-300 transition-all hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white"
          >
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>Launch Live Demo</span>
          </button>
        )}
      </div>

      {statusMessage && (
        <p className="font-mono text-xs text-cyan-400 animate-pulse">{statusMessage}</p>
      )}
    </div>
  );
}
