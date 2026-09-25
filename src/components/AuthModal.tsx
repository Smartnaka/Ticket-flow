import { Eye, EyeOff, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { UserRole } from '../types';
import {
  isValidEmail,
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  NIGERIAN_PHONE_DIGITS,
  normalizeEmail,
  normalizeName,
  normalizeNigerianPhoneInput,
  toNigerianE164,
} from '../utils/authValidation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any, token: string) => void;
  initialMode?: 'login' | 'register' | 'forgot' | 'reset';
  resetToken?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, initialMode = 'login', resetToken }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('CUSTOMER');
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setInfoMsg('');
    }
  }, [initialMode, isOpen]);

  useEffect(() => () => requestController.current?.abort(), []);

  if (!isOpen) return null;

  const messageForRequestError = (err: unknown, fallback: string) => {
    if (err instanceof DOMException && err.name === 'AbortError') return 'Request cancelled.';
    const message = err instanceof Error ? err.message : '';
    if (/string did not match the expected pattern|failed to fetch|networkerror|load failed/i.test(message)) {
      return 'We could not reach the server. Check your internet connection and try again.';
    }
    return message || fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setInfoMsg('');

    const normalizedEmail = normalizeEmail(email);
    const normalizedName = normalizeName(name);
    const phoneResult = normalizeNigerianPhoneInput(phone);

    if (mode !== 'reset' && !normalizedEmail) {
      setError('Email address is required.');
      return;
    }
    if (mode !== 'reset' && !isValidEmail(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (mode === 'register') {
      if (!normalizedName) {
        setError('Full name is required.');
        return;
      }
      if (normalizedName.length > MAX_NAME_LENGTH) {
        setError(`Full name must be ${MAX_NAME_LENGTH} characters or fewer.`);
        return;
      }
      if (phoneResult.error) {
        setError(phoneResult.error);
        return;
      }
      if (phoneResult.digits.length !== NIGERIAN_PHONE_DIGITS) {
        setError('Enter the 10 digits after +234 for your Nigerian phone number.');
        return;
      }
    }

    if (mode === 'register' || mode === 'reset') {
      if (password !== passwordConfirm) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    if ((mode === 'register' || mode === 'reset') && password.length > MAX_PASSWORD_LENGTH) {
      setError(`Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    requestController.current = controller;

    const getResponseData = async (res: Response) => {
      try {
        return await res.json();
      } catch {
        return {};
      }
    };

    const getUserMessage = (response: Response, data: unknown, fallback: string) => {
      const candidate = data && typeof data === 'object' && 'error' in data ? (data as { error?: unknown }).error : undefined;
      if (typeof candidate === 'string' && candidate.trim() && !/string did not match the expected pattern/i.test(candidate)) return candidate;
      if (response.status >= 500) return 'We could not create your account right now. Please try again shortly.';
      return fallback;
    };

    if (mode === 'forgot') {
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail }),
          signal: controller.signal,
        });
        const data = await getResponseData(res);
        if (!res.ok) throw new Error(getUserMessage(res, data, 'Unable to request a password reset. Check your email address and try again.'));
        setInfoMsg(data.message);
      } catch (err: any) {
        console.error('Password reset request failed', err);
        setError(messageForRequestError(err, 'Unable to request a password reset. Please try again.'));
      } finally {
        setLoading(false);
        requestController.current = null;
      }
      return;
    }



    if (mode === 'reset') {
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password }),
          signal: controller.signal,
        });
        const data = await getResponseData(res);
        if (!res.ok) throw new Error(getUserMessage(res, data, 'Unable to reset your password. Please try again.'));
        setInfoMsg(data.message);
        setPassword('');
        setPasswordConfirm('');
        window.history.replaceState({}, document.title, window.location.pathname);
        setMode('login');
      } catch (err: any) {
        console.error('Password reset failed', err);
        setError(messageForRequestError(err, 'Unable to reset your password. Please try again.'));
      } finally {
        setLoading(false);
        requestController.current = null;
      }
      return;
    }

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = mode === 'register'
      ? { email: normalizedEmail, password, name: normalizedName, phone: toNigerianE164(phoneResult.digits), role }
      : { email: normalizedEmail, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await getResponseData(res);
      if (!res.ok) throw new Error(getUserMessage(res, data, mode === 'register' ? 'Unable to create your account. Please check your details and try again.' : 'Unable to sign in. Check your email and password.'));
      if (!data || typeof data !== 'object' || !('user' in data) || !('token' in data) || typeof data.token !== 'string') {
        console.error('Unexpected authentication response', data);
        throw new Error('We received an unexpected response. Please try again.');
      }

      onSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      console.error(`${mode} request failed`, err);
      setError(messageForRequestError(err, 'Unable to complete your request. Check your connection and try again.'));
    } finally {
      setLoading(false);
      requestController.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45  p-4">
      <div className="bg-white border border-zinc-100 rounded-lg w-full max-w-md p-6 shadow-sm space-y-6 relative">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-950 p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-zinc-950">
            {mode === 'register'
              ? 'Create TicketWave Account'
              : mode === 'forgot'
              ? 'Reset Your Password'
              : mode === 'reset'
              ? 'Choose a New Password'
              : 'Welcome Back'}
          </h2>
          <p className="text-xs text-zinc-600">
            {mode === 'register'
              ? 'Join thousands of eventgoers and organizers'
              : mode === 'forgot'
              ? 'Enter your email to receive password reset instructions'
              : mode === 'reset'
              ? 'Enter and confirm your new password to complete account recovery'
              : 'Sign in to access your tickets and orders'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
            {error}
          </div>
        )}

        {infoMsg && (
          <div className="p-3 bg-teal-600/10 border border-teal-600/20 text-teal-700 rounded-xl text-xs">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder="e.g. Chidi Okonkwo"
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3.5 py-2.5 text-sm text-zinc-950 focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Phone Number
                </label>
                <div className="flex rounded-xl border border-zinc-100 bg-zinc-50 focus-within:border-teal-600">
                  <span className="flex items-center border-r border-zinc-200 px-3.5 text-sm text-zinc-600 select-none" aria-hidden="true">+234</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(e) => {
                      const result = normalizeNigerianPhoneInput(e.target.value);
                      if (result.error) {
                        setError(result.error);
                        return;
                      }
                      setError('');
                      setPhone(result.digits);
                    }}
                    placeholder="8012345678"
                    aria-label="Nigerian phone number, 10 digits after +234"
                    className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm text-zinc-950 focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">Enter the 10 digits after +234 (without the leading 0).</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Account Type
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3.5 py-2.5 text-sm text-zinc-950 focus:outline-none focus:border-teal-600"
                >
                  <option value="CUSTOMER">Customer (Buy Tickets)</option>
                  <option value="ORGANIZER">Organizer (Host & Sell Events)</option>
                </select>
              </div>
            </>
          )}

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Email Address
              </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={MAX_EMAIL_LENGTH}
              placeholder="you@example.com"
              className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3.5 py-2.5 text-sm text-zinc-950 focus:outline-none focus:border-teal-600"
              />
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-zinc-700">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setInfoMsg('');
                    }}
                    className="text-[11px] text-teal-700 hover:text-teal-600 transition"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={MAX_PASSWORD_LENGTH}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3.5 py-2.5 pr-11 text-sm text-zinc-950 focus:outline-none focus:border-teal-600"
                />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-600 hover:text-zinc-950" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {(mode === 'register' || mode === 'reset') && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showPasswordConfirm ? 'text' : 'password'}
                  required
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  maxLength={MAX_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-3.5 py-2.5 pr-11 text-sm text-zinc-950 focus:outline-none focus:border-teal-600"
                />
                <button type="button" onClick={() => setShowPasswordConfirm((visible) => !visible)} className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-600 hover:text-zinc-950" aria-label={showPasswordConfirm ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showPasswordConfirm}>
                  {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {loading
              ? 'Processing...'
              : mode === 'register'
              ? 'Create Account'
              : mode === 'forgot'
              ? 'Send Reset Link'
              : mode === 'reset'
              ? 'Update Password'
              : 'Sign In'}
          </button>
        </form>

        <div className="text-center pt-2 flex flex-col space-y-2">
          {mode === 'login' && (
            <button
              onClick={() => {
                setMode('register');
                setError('');
                setInfoMsg('');
              }}
              className="text-xs text-teal-700 hover:text-teal-600 transition"
            >
              Don't have an account? Register
            </button>
          )}

          {(mode === 'register' || mode === 'forgot' || mode === 'reset') && (
            <button
              onClick={() => {
                setMode('login');
                setError('');
                setInfoMsg('');
              }}
              className="text-xs text-teal-700 hover:text-teal-600 transition"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
