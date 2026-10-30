/**
 * Settings page: username, email, password, accent colour and provider connections.
 * Email and password changes ask for the current password first, so someone
 * with an open session on a shared phone cannot lock the owner out.
 */
import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { USERNAME_HELP, isValidUsername, normalizeUsername } from '../lib/username.js';
import { ACCENTS, saveAccent, useAccent } from '../lib/accent.js';
import { meter } from '../lib/dots.js';
import Connections from './Connections.jsx';
import DotGrid from './DotGrid.jsx';
import { CircleButton } from './ui.jsx';
import Spinner from './Spinner.jsx';
import PasswordInput from './PasswordInput.jsx';

const input = 'field';
const save = 'btn-primary self-start';

/** Re-checks the current password by signing in with it. Throws a friendly error. */
async function confirmPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Current password is incorrect.');
}

/** A settings section: plain label plus content. */
function Card({ title, children }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="m-0 text-sm font-normal">{title}</h2>
      {children}
    </section>
  );
}

const PREVIEW = meter(16, 24, { tail: true });

/** Accent colour swatches; the whole app recolours on tap. Saved to this account only. */
function AccentPicker({ userId, onNotice, onSaved }) {
  const current = useAccent();
  const [saving, setSaving] = useState(false);
  const pick = async (id) => {
    if (id === current.id || saving) return;
    setSaving(true);
    try {
      await saveAccent(userId, id);
      onSaved();
    } catch (e) {
      onNotice({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="eyebrow m-0 font-normal">Accent color</h2>
      <div className="card flex flex-col gap-[18px] p-5">
        <DotGrid grid={PREVIEW} label="Preview of the selected accent color on a dot bar" />
        <div className="flex flex-wrap gap-2.5">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              aria-label={a.name}
              aria-pressed={a.id === current.id}
              disabled={saving}
              onClick={() => pick(a.id)}
              className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-black p-1 ${
                a.id === current.id ? 'border-white' : 'border-line-strong'
              }`}
            >
              <span className="h-full w-full rounded-full" style={{ background: a.hex }} />
            </button>
          ))}
        </div>
        <p className="m-0 text-xs leading-relaxed text-muted">
          {current.name}. Used for charts, highlights and buttons across the app. Colors are tuned to stay bright on
          black. Saved to your account, so it only changes the app for you.
        </p>
      </div>
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
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <input
        type="text"
        required
        autoComplete="username"
        placeholder="Username"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={input}
      />
      <p className="m-0 text-xs leading-relaxed text-muted">{USERNAME_HELP} You can sign in with it.</p>
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
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <p className="m-0 text-[13px] text-muted">Current: <span className="text-white">{email}</span></p>
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
    <form onSubmit={submit} className="flex flex-col gap-2.5">
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
    <div className="mx-auto flex max-w-md flex-col gap-8">
      <header className="flex items-center gap-3.5">
        <CircleButton icon="back" label="Back" onClick={onBack} />
        <h1 className="m-0 font-dot text-[30px] font-black tracking-[0.03em] uppercase">Settings</h1>
      </header>

      {profile === undefined ? (
        <p className="py-8 text-center text-sm text-muted">Loading…</p>
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

      <AccentPicker userId={userId} onNotice={onNotice} onSaved={onProfileChanged} />

      {/* Connections has its own card, so it is rendered without a wrapper here. */}
      <Connections connections={connections} onNotice={onNotice} onChanged={onConnectionsChanged} />
    </div>
  );
}
