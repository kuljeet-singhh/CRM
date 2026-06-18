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
  already_registered: 'An account with this email already exists. Sign in instead.',
  weak_password: 'Password must be at least 8 characters.',
  invalid_email: 'Enter a valid email address.',
};

export default function SignUp() {
  const { isLoading, isAuthenticated, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await register(email, password, name || undefined);
      toast.success('Account created successfully.');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      toast.error(ERROR_MESSAGES[code ?? ''] ?? 'Sign up failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
        title="Create account"
        subtitle="Get started with FlyCRM"
        footer={
          <>
            Already have an account?{' '}
            <Link to="/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <Card className="border-border/50 bg-gradient-surface">
          <CardHeader>
            <CardTitle>Email sign up</CardTitle>
            <CardDescription>Create your account with email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Name</Label>
                <Input
                  id="signup-name"
                  name="signup-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  name="signup-email"
                  type="email"
                  autoComplete="email"
                  readOnly
                  onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <PasswordInput
                  id="signup-password"
                  name="signup-password"
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">Confirm password</Label>
                <PasswordInput
                  id="signup-confirm-password"
                  name="signup-confirm-password"
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
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
