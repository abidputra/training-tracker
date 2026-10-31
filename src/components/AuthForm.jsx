/**
 * Sign in / sign up (Supabase Auth).
 *   Sign in: email OR username + password. A username is turned into the
 *            account's email through the email_for_username() function.
 *   Sign up: username + email + password. Username is checked for availability
 *            first, and stored in the signup metadata (copied to `profiles` by a trigger).
 *            The account is created without starting a session, then the form goes back
 *            to Sign in with the username filled in, so new users log in themselves.
 */
import { useState } from 'react';
import { supabase, supabaseSignup } from '../lib/supabase.js';
import { USERNAME_HELP, isValidUsername, normalizeUsername } from '../lib/username.js';
import PasswordInput from './PasswordInput.jsx';

const input = 'field';

export default function AuthForm() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [identifier, setIdentifier] = useState(''); // sign in: email or username
  const [username, setUsername] = useState(''); // sign up
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'error' | 'info', text }

  async function signIn() {
    let email = identifier.trim();
    if (!email.includes('@')) {
      const { data, error } = await supabase.rpc('email_for_username', { uname: normalizeUsername(email) });
      if (error) throw error;
      // Same message as a wrong password, so the form does not reveal which usernames exist.
      if (!data) throw new Error('Invalid login credentials');
      email = data;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp() {
    const uname = normalizeUsername(username);
    if (!isValidUsername(uname)) throw new Error(`Invalid username. ${USERNAME_HELP}`);
    const { data: free, error: checkError } = await supabase.rpc('username_available', { uname });
    if (checkError) throw checkError;
    if (!free) throw new Error('That username is already taken.');

    const { data, error } = await supabaseSignup.auth.signUp({
      email,
      password,
      options: { data: { username: uname } },
    });
    if (error) throw error;
    // With email confirmation on, Supabase hides whether an email is registered: signUp
    // "succeeds" for an existing address but returns a user with no identities.
    if (data.user?.identities?.length === 0) {
      throw new Error('This email is already registered. Try signing in instead.');
    }
    // Back to the sign-in form with the username ready; only the password is left to type.
    // (Email confirmation on: no session exists yet either way, the link has to be clicked first.)
    setMode('signin');
    setIdentifier(uname);
    setUsername('');
    setEmail('');
    setPassword('');
    setMessage({
      type: 'info',
      text: data.session
        ? 'Account created. Sign in to continue.'
        : 'Account created. Check your email to confirm it, then sign in.',
    });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') await signIn();
      else await signUp();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="m-0 mb-3 font-dot text-[44px] leading-[0.92] font-black tracking-[0.02em] uppercase">
        All-in-One
        <br />
        Training Tracker
      </h1>
      <p className="m-0 mb-8 text-sm text-muted">Your Garmin training, one live page.</p>

      <form onSubmit={submit} className="flex flex-col gap-2.5">
        {mode === 'signin' ? (
          <input
            type="text"
            required
            autoComplete="username"
            placeholder="Email or username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={input}
          />
        ) : (
          <>
            <input
              type="text"
              required
              autoComplete="username"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={input}
            />
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </>
        )}
        <PasswordInput
          required
          minLength={8}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
        <button
          disabled={busy}
          className="btn-primary mt-1 w-full"
        >
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {message && (
        <p className={`m-0 mt-3 text-sm ${message.type === 'error' ? 'text-accent' : 'text-white'}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin');
          setIdentifier('');
          setUsername('');
          setEmail('');
          setPassword('');
          setMessage(null);
        }}
        className="mt-6 text-sm text-muted underline"
      >
        {mode === 'signin' ? 'No account? Sign up' : 'Have an account? Sign in'}
      </button>
    </div>
  );
}
