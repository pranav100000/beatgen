import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useState } from 'react'
import { publicRoute } from '../platform/auth/auth-utils.tsx'
import { useAuth } from '../platform/auth/auth-context'

// Shadcn/ui and lucide-react imports
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Alert as ShadcnAlert, AlertDescription, AlertTitle } from "../components/ui/alert" // Renamed to avoid conflict
import { Separator } from "../components/ui/separator"
import { Loader2, AlertCircle } from "lucide-react"

// Placeholder for GoogleIcon, replace with actual SVG or a better Lucide icon if available
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path d="M12 5.38c1.63 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    <path d="M1 1h22v22H1z" fill="none"/>
  </svg>
);

// Login route - this will render at the path '/login'
export const Route = createFileRoute('/login')({
  component: LoginPage,
  // Redirect if already logged in
  ...publicRoute('/home'),
})

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    localStorage.removeItem('access_token');
    
    try {
      const result = await signIn(email, password);
      
      if (result.success) {
        setTimeout(() => {
          window.location.href = '/home';
        }, 100);
      } else {
        if (result.message) {
          setError(result.message);
        } else if (result.error) {
          if (result.error.message.includes('Network Error')) {
            setError('Cannot connect to the authentication server. Please check your internet connection or try again later.');
          } else {
            setError(result.error.message || 'Invalid email or password');
          }
        } else {
          setError('Authentication failed. Please check your credentials and try again.');
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Network Error')) {
          setError('Cannot connect to the server. Please check your internet connection.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    
    try {
      localStorage.setItem('auth_redirect', '/home');
      await signInWithGoogle();
    } catch (err) {
      console.error('Google login error:', err);
      setError('Failed to connect to Google authentication service.');
      setIsGoogleLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-[512px] mx-auto space-y-8 bg-card p-6 sm:p-8 rounded-xl shadow-xl">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            Log In to BeatGen
          </h1>
        </div>
        
        {error && (
          <ShadcnAlert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </ShadcnAlert>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="space-y-2">
              <Label htmlFor="email-address">Email address</Label>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isGoogleLoading}
              />
            </div>
            <div className="space-y-2 pt-4">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isGoogleLoading}
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full group"
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </div>
          
          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              OR
            </span>
          </div>
            
          <div>
            <Button
              variant="outline"
              className="w-full group"
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  <span className="ml-2">Continue with Google</span>
                </>
              )}
            </Button>
          </div>
            
          <div className="mt-6 text-center text-sm">
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <Button
                variant="link"
                className="font-medium text-primary hover:text-primary/90 p-0 h-auto"
                onClick={() => navigate({ to: '/register' })}
              >
                Sign up
              </Button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}