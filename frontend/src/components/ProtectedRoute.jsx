import { useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';

export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { t } = useI18n();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-vg-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-vg-accent flex items-center justify-center animate-pulse-glow">
            <span className="text-white font-bold text-lg">VG</span>
          </div>
          <span className="text-vg-text-muted text-sm">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return children;
}
