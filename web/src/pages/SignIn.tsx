import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  use_oauth: 'This account uses Gmail or Outlook sign-in.',
};

export default function SignIn() {
  const { isLoading, isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success('Signed in successfully.');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      toast.error(ERROR_MESSAGES[code ?? ''] ?? 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
        title="Sign in"
        subtitle="Welcome back to FlyCRM"
        footer={
          <>
            Don&apos;t have an account?{' '}
            <Link to="/sign-up" className="text-primary hover:underline">
              Sign up
            </Link>
          </>
        }
      >
        <Card className="border-border/50 bg-gradient-surface">
          <CardHeader>
            <CardTitle>Email sign in</CardTitle>
            <CardDescription>Use your email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  name="signin-email"
                  type="email"
                  autoComplete="username"
                  readOnly
                  onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <PasswordInput
                  id="signin-password"
                  name="signin-password"
                  autoComplete="current-password"
                  readOnly
                  onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <OAuthButtons returnTo="/dashboard" />
          </CardContent>
        </Card>
      </AuthLayout>
  );
}
