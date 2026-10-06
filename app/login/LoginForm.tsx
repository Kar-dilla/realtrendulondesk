'use client';
import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { createClient, SupabaseConfigError } from '@/lib/supabase/client';

function messageFor(error: { code?: string; status?: number; message: string }): string {
  if (error.code === 'invalid_credentials' || error.status === 400) {
    return "That email and password don't match. Check both and try again. If they look right, ask the Lead to check your account.";
  }
  if (error.status === 429) {
    return 'Too many sign-in attempts. Wait a minute, then try again.';
  }
  if (!error.status) {
    return "Couldn't reach the sign-in service. Check your connection and try again.";
  }
  return `Sign-in failed: ${error.message}. Try again, and tell the Lead if it keeps happening.`;
}

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(null);

    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError('Enter your email and password, then try again.');
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: trimmed, password });
      if (signInError) {
        setError(messageFor(signInError));
        setPending(false);
        return;
      }
      // Full navigation so the proxy and the layout both see the new session.
      window.location.assign('/dashboard');
    } catch (err) {
      setError(
        err instanceof SupabaseConfigError
          ? 'Sign-in is not set up yet. Ask the Lead to add the Supabase keys to .env and restart the app.'
          : "Couldn't reach the sign-in service. Check your connection and try again.",
      );
      setPending(false);
    }
  }

  return (
    <form className="tl-login__form" onSubmit={onSubmit} noValidate>
      <label className="tl-field">
        <span className="tl-field__label">Email</span>
        <input
          className="tl-input"
          type="email"
          name="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          disabled={pending}
          required
        />
      </label>
      <label className="tl-field">
        <span className="tl-field__label">Password</span>
        <input
          className="tl-input"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          disabled={pending}
          required
        />
      </label>
      {error ? (
        <p className="tl-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="tl-btn tl-btn--primary tl-login__submit" disabled={pending}>
        <LogIn size={18} strokeWidth={2} aria-hidden="true" />
        {pending ? 'Signing in…' : 'Enter the newsroom'}
      </button>
    </form>
  );
}
