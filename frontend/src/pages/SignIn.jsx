import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import PageBackdrop from '../components/PageBackdrop';
import { clerkAuthAppearance } from '../clerkAuthAppearance';

export default function SignIn() {
  return (
    <div className="auth-page min-h-screen flex flex-col items-center justify-center px-4 relative">
      <PageBackdrop />

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <Link
          to="/"
          className="flex items-center justify-center gap-3 mb-8 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#2563eb] flex items-center justify-center glow-blue-sm shadow-lg shadow-blue-900/40 group-hover:shadow-blue-500/25 transition-all duration-300">
            <span className="text-white font-bold text-xl tracking-tight">VG</span>
          </div>
          <span className="text-2xl font-semibold text-slate-100 tracking-tight group-hover:text-glow transition-all duration-300">
            VisionGuard
          </span>
        </Link>

        <div className="auth-card">
          <ClerkSignIn
            appearance={clerkAuthAppearance}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            forceRedirectUrl="/dashboard"
          />
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 opacity-50">
          <div className="h-px w-14 bg-gradient-to-r from-transparent via-[#1e3a5f] to-[#2563eb]/60" />
          <div className="size-1.5 rounded-full bg-[#2563eb]/80 shadow-[0_0_12px_rgba(37,99,235,0.5)]" />
          <div className="h-px w-14 bg-gradient-to-l from-transparent via-[#1e3a5f] to-[#2563eb]/60" />
        </div>
      </div>
    </div>
  );
}
