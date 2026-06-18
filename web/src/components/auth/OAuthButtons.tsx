import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { connectPath } from '@/lib/provider';

interface OAuthButtonsProps {
  mode?: 'login' | 'connect';
  returnTo?: string;
  disabled?: boolean;
}

export function OAuthButtons({ mode = 'login', returnTo, disabled }: OAuthButtonsProps) {
  const go = (provider: 'gmail' | 'outlook') => {
    if (disabled) return;
    window.location.href = connectPath(provider, { mode, returnTo });
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        onClick={() => go('gmail')}
        disabled={disabled}
        className="h-11 w-full bg-gradient-primary text-primary-foreground hover:opacity-90"
      >
        <Mail className="mr-2 h-4 w-4" />
        Continue with Gmail
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => go('outlook')}
        disabled={disabled}
        className="h-11 w-full"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M7.5 4h9A4.5 4.5 0 0 1 21 8.5v7A4.5 4.5 0 0 1 16.5 20h-9A4.5 4.5 0 0 1 3 15.5v-7A4.5 4.5 0 0 1 7.5 4Zm0 2A2.5 2.5 0 0 0 5 8.5v7A2.5 2.5 0 0 0 7.5 18h9a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 16.5 6h-9Z" />
          <path d="M6 8.5 12 12.5l6-4v7.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 15.5V8.5Z" />
        </svg>
        Continue with Outlook
      </Button>
    </div>
  );
}
