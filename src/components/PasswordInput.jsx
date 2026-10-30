/**
 * Password field with a show/hide button. Takes the same props as <input>
 * (type is controlled here). The button does not steal focus, so the phone
 * keyboard stays open while toggling.
 */
import { useState } from 'react';

const Eye = ({ off }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

export default function PasswordInput({ className = '', style, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={className}
        style={{ ...style, paddingRight: '3rem' }} // room for the button
      />
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted active:text-white"
      >
        <Eye off={visible} />
      </button>
    </div>
  );
}
