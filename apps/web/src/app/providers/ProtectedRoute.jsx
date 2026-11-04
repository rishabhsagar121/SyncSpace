import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@/features/auth/authSlice';
import { useBootstrapAuth } from '@/features/auth/hooks/useAuth';
import SyncPulse from '@/components/brand/SyncPulse';

export default function ProtectedRoute() {
  const ready = useBootstrapAuth();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stage">
        <SyncPulse size={40} live />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}