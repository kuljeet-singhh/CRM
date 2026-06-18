import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Sparkles } from 'lucide-react';
import { connectPath } from '@/lib/provider';
import type { AuthProvider } from '@/types';

interface ConnectProviderProps {
  compact?: boolean;
  connectDisabled?: boolean;
}

export function ConnectProvider({ compact, connectDisabled }: ConnectProviderProps) {
  const connect = (provider: AuthProvider) => {
    if (connectDisabled) return;
    window.location.href = connectPath(provider);
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => connect('gmail')}
          disabled={connectDisabled}
          className="bg-gradient-primary text-primary-foreground"
        >
          Connect Gmail
        </Button>
        <Button variant="outline" onClick={() => connect('outlook')} disabled={connectDisabled}>
          Connect Outlook
        </Button>
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-xl border-border/50 bg-gradient-surface shadow-accent">
      <CardHeader className="text-center sm:text-left">
        <CardTitle className="flex items-center justify-center gap-2 sm:justify-start">
          <Sparkles className="h-5 w-5 text-primary" />
          Get started
        </CardTitle>
        <CardDescription>
          Choose your email provider to connect FlyCRM and unlock Message Center.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={() => connect('gmail')}
          disabled={connectDisabled}
          className="h-12 flex-1 bg-gradient-primary text-primary-foreground hover:opacity-90"
        >
          <Mail className="mr-2 h-4 w-4" />
          Connect Gmail
        </Button>
        <Button
          variant="outline"
          onClick={() => connect('outlook')}
          disabled={connectDisabled}
          className="h-12 flex-1"
        >
          <svg
            className="mr-2 h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M7.5 4h9A4.5 4.5 0 0 1 21 8.5v7A4.5 4.5 0 0 1 16.5 20h-9A4.5 4.5 0 0 1 3 15.5v-7A4.5 4.5 0 0 1 7.5 4Zm0 2A2.5 2.5 0 0 0 5 8.5v7A2.5 2.5 0 0 0 7.5 18h9a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 16.5 6h-9Z" />
            <path d="M6 8.5 12 12.5l6-4v7.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 15.5V8.5Z" />
          </svg>
          Connect Outlook
        </Button>
      </CardContent>
    </Card>
  );
}
