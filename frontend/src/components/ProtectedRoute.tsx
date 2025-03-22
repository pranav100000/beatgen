import { Navigate } from 'react-router-dom';
import { useAuth } from '../core/auth/auth-context';
import { ReactElement } from 'react';

interface ProtectedRouteProps {
  children: ReactElement;
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  redirectTo = '/' 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    // You could render a loading spinner here
    return <div></div>;
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}