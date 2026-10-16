/**
 * Settings page: username, email, password and provider connections.
 * Email and password changes ask for the current password first, so someone
 * with an open session on a shared phone cannot lock the owner out.
 */
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { USERNAME_HELP, isValidUsername, normalizeUsername } from '../lib/username.js';
import Connections from './Connections.jsx';
import Spinner from './Spinner.jsx';
import PasswordInput from './PasswordInput.jsx';

const input =
  'w-full rounded-xl bg-slate-950 px-4 py-3 text-base outline-none ring-1 ring-slate-800 focus:ring-emerald-500';
const save =
  'flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-50';

/** Re-checks the current password by signing in with it. Throws a friendly error. */
async function confirmPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Current password is incorrect.');
}

/** A settings card: title plus content. */
function Card({ title, children }) {
  return (
    <section className="rounded-2xl bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

/** Wraps a form submit: busy state, and errors/success go to the snackbar. */
function useSubmit(onNotice) {
  const [busy, setBusy] = useState(false);
  const run = async (fn, okText) => {
    setBusy(true);
    try {
      await fn();
      if (okText) onNotice({ type: 'info', text: okText });
      return true;
    } catch (e) {
      onNotice({ type: 'error', text: e.message });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function UsernameForm({ userId, current, onNotice, onSaved }) {
  const [value, setValue] = useState(current ?? '');
  const { busy, run } = useSubmit(onNotice);

  async function submit(e) {
    e.preventDefault();
    const uname = normalizeUsername(value);
    if (!isValidUsername(uname)) return onNotice({ type: 'error', text: `Invalid username. ${USERNAME_HELP}` });
    if (uname === current) return undefined;
    const ok = await run(async () => {
      const { data: free, error: checkError } = await supabase.rpc('username_available', { uname });
      if (checkError) throw checkError;
      if (!free) throw new Error('That username is already taken.');
      const { error } = await supabase.from('profiles').update({ username: uname }).eq('id', userId);
      if (error) throw error.code === '23505' ? new Error('That username is already taken.') : error;
    }, 'Username updated.');
    if (ok) onSaved();
    return undefined;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="text"
        required
        autoComplete="username"
        placeholder="Username"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={input}
      />
      <p className="text-xs text-slate-500">{USERNAME_HELP} You can sign in with it.</p>
      <button disabled={busy} className={save}>
        {busy && <Spinner />} Save username
      </button>
    </form>
  );
}

function EmailForm({ email, onNotice }) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, run } = useSubmit(onNotice);

  async function submit(e) {
    e.preventDefault();
    const ok = await run(async () => {
      await confirmPassword(email, password);
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
    }, 'Check your new email address to confirm the change.');
    if (ok) {
      setNewEmail('');
      setPassword('');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-slate-400">Current: <span className="text-slate-200">{email}</span></p>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="New email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        className={input}
      />
      <PasswordInput
        required
        autoComplete="current-password"
        placeholder="Current password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={input}
      />
      <button disabled={busy} className={save}>
        {busy && <Spinner />} Change email
      </button>
    </form>
  );
}

function PasswordForm({ email, onNotice }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, run } = useSubmit(onNotice);

  async function submit(e) {
    e.preventDefault();
    if (next !== confirm) return onNotice({ type: 'error', text: 'The new passwords do not match.' });
    const ok = await run(async () => {
      await confirmPassword(email, current);
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
    }, 'Password updated.');
    if (ok) {
      setCurrent('');
      setNext('');
      setConfirm('');
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <PasswordInput
        required
        autoComplete="current-password"
        placeholder="Current password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className={input}
      />
      <PasswordInput
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="New password (8+ characters)"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className={input}
      />
      <PasswordInput
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Repeat new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className={input}
      />
      <button disabled={busy} className={save}>
        {busy && <Spinner />} Change password
      </button>
    </form>
  );
}

export default function Settings({ session, profile, connections, onBack, onNotice, onProfileChanged, onConnectionsChanged }) {
  const email = session.user.email;
  const userId = session.user.id;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-lg text-slate-200 ring-1 ring-slate-700 active:bg-slate-700"
        >
          ‹
        </button>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
      </header>

      {profile === undefined ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : (
        <Card title="Username">
          <UsernameForm
            key={profile.username ?? ''}
            userId={userId}
            current={profile.username}
            onNotice={onNotice}
            onSaved={onProfileChanged}
          />
        </Card>
      )}

      <Card title="Email">
        <EmailForm email={email} onNotice={onNotice} />
      </Card>

      <Card title="Password">
        <PasswordForm email={email} onNotice={onNotice} />
      </Card>

      {/* Connections has its own card, so it is rendered without a wrapper here. */}
      <Connections connections={connections} onNotice={onNotice} onChanged={onConnectionsChanged} />
    </div>
  );
}
