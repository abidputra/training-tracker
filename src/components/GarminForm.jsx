/**
 * Garmin login form (2 steps: credentials, then MFA code only if Garmin asks).
 *
 * The password goes to OUR Garmin service over HTTPS, is used once to log in,
 * and is never stored. Only an encrypted session token is kept server-side.
 */
import { useState } from 'react';
import { garminApi } from '../lib/api.js';
import Spinner from './Spinner.jsx';
import PasswordInput from './PasswordInput.jsx';

export default function GarminForm({ onDone, onCancel }) {
  const [step, setStep] = useState('creds'); // 'creds' | 'mfa'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        step === 'creds'
          ? await garminApi('/garmin/connect', { body: { email, password } })
          : await garminApi('/garmin/mfa', { body: { code } });
      if (res.status === 'mfa_required') {
        setPassword(''); // no longer needed in the browser
        setStep('mfa');
      } else {
        onDone(`Garmin connected, ${res.imported} activities imported.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const input = 'field';

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5">
      {step === 'creds' ? (
        <>
          <input type="email" required autoComplete="username" placeholder="Garmin email"
            value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <PasswordInput required autoComplete="current-password" placeholder="Garmin password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          <p className="m-0 text-xs leading-relaxed text-muted">
            Your password is used once to log in and is never stored. Only an encrypted session token is saved.
          </p>
        </>
      ) : (
        <>
          <p className="m-0 text-sm">Garmin sent you a verification code. Enter it below.</p>
          <input inputMode="numeric" autoComplete="one-time-code" required placeholder="6-digit code"
            value={code} onChange={(e) => setCode(e.target.value)} className={input} />
        </>
      )}

      {error && <p className="m-0 text-sm text-accent">{error}</p>}

      <div className="flex gap-2">
        <button disabled={busy} className="btn-primary flex-1">
          {busy && <Spinner />}
          {busy ? 'Working…' : step === 'creds' ? 'Connect' : 'Verify'}
        </button>
        <button type="button" onClick={onCancel} className="btn">
          Cancel
        </button>
      </div>
    </form>
  );
}
