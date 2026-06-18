import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: 'Sign-in was cancelled.',
  oauth_failed: 'Sign-in failed. Please try again.',
  oauth_state_invalid: 'Sign-in session expired. Please try again.',
  provider_conflict: 'This email is already linked to another provider.',
  no_email: 'Could not read your email from the provider.',
  connect_requires_auth: 'Please sign in before connecting your inbox.',
};

export function OAuthTokenHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { captureOAuthToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const connected = searchParams.get('connected');

    if (error) {
      toast.error(ERROR_MESSAGES[error] ?? 'Authentication failed.');
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      setSearchParams(next, { replace: true });
      return;
    }

    if (!token) return;

    void captureOAuthToken(token).then(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('token');
    next.delete('connected');
    next.delete('returnTo');
    const search = next.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true }
    );

    if (connected) {
      toast.success(`${connected === 'gmail' ? 'Gmail' : 'Outlook'} connected successfully.`);
    }
    });
  }, [searchParams, setSearchParams, captureOAuthToken, navigate, location.pathname]);

  return null;
}
