import type { Metadata } from 'next';
import Image from 'next/image';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in · Trendulon Newsroom',
};

export default function LoginPage() {
  return (
    <main className="tl-login tl-orbit-glow">
      <Image
        src="/brand/trendulon-logo-full.png"
        alt="Trendulon. Global stories. Told the right way."
        width={0}
        height={0}
        sizes="(max-width: 480px) 70vw, 280px"
        style={{ width: 'min(70vw, 280px)', height: 'auto' }}
        priority
        className="tl-login__logo"
      />
      <h1 className="tl-login__title">Private newsroom</h1>
      <p className="tl-login__lede">Trendulon&apos;s editorial intelligence platform. Sign in to continue.</p>
      <LoginForm />
      <p className="tl-login__note">Internal tool. The editor approves everything before it goes out.</p>
    </main>
  );
}
