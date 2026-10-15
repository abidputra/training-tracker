/** Email + password sign in / sign up (Supabase Auth). */
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AuthForm() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'error' | 'info', text }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMessage({ type: 'error', text: error.message });
    // With email confirmation enabled, signUp returns no session until the link is clicked.
    if (mode === 'signup' && !data.session) {
      setMessage({ type: 'info', text: 'Check your email to confirm your account, then sign in.' });
    }
    return undefined;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold text-white">Training Tracker</h1>
      <p className="mb-6 text-sm text-slate-400">Garmin and Strava, one live page.</p>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base outline-none ring-1 ring-slate-800 focus:ring-emerald-500"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base outline-none ring-1 ring-slate-800 focus:ring-emerald-500"
        />
        <button
          disabled={busy}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-medium text-slate-950 disabled:opacity-50"
        >
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {message && (
        <p className={`mt-3 text-sm ${message.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setMessage(null);
        }}
        className="mt-6 text-sm text-slate-400 underline"
      >
        {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
      </button>
    </div>
  );
}
