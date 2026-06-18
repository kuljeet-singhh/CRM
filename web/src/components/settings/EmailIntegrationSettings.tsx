import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, Mail, Database, Settings2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { initiateConnect } from '@/lib/provider';
import { useAuth } from '@/hooks/useAuth';
import { usePreferences } from '@/lib/preferences';
import { toast } from 'sonner';
import type { GmailSyncHealth } from '@/types';

interface EmailIntegrationSettingsProps {
  onOpenSettingsModal: () => void;
}

export function EmailIntegrationSettings({ onOpenSettingsModal }: EmailIntegrationSettingsProps) {
  const { user, isAuthenticated } = useAuth();
  const { settings } = usePreferences();
  const mailProvider = user?.mailProvider;

  const healthQuery = useQuery({
    queryKey: ['health', 'gmail-sync'],
    queryFn: () => api<GmailSyncHealth>('/api/health/gmail-sync'),
    enabled: isAuthenticated && mailProvider === 'gmail',
  });

  const handleConnect = async (provider: 'gmail' | 'outlook') => {
    try {
      await initiateConnect(provider, '/settings');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      toast.error(code === 'unauthorized' ? 'Please sign in again.' : 'Could not start connect flow.');
    }
  };

  const gmailConnected = mailProvider === 'gmail';
  const outlookConnected = mailProvider === 'outlook';

  return (
    <Card className="bg-gradient-surface border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Integrations & Connections
        </CardTitle>
        <CardDescription>Connect FlyCRM with your email and import tools</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-background/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h4 className="font-medium">Gmail</h4>
              <p className="text-sm text-muted-foreground">Sync emails via label + webhook</p>
              {gmailConnected && settings?.syncSelector && (
                <p className="text-xs text-muted-foreground mt-1">
                  Sync label: <strong>{settings.syncSelector}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && gmailConnected ? (
              <>
                <Badge variant="secondary">Connected</Badge>
                <Button variant="outline" size="sm" onClick={onOpenSettingsModal}>
                  <Settings2 className="h-4 w-4 mr-1" />
                  Email sync settings
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => void handleConnect('gmail')}>
                Connect
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-background/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <h4 className="font-medium">Outlook</h4>
              <p className="text-sm text-muted-foreground">Sync emails via mail folder</p>
              {outlookConnected && settings?.syncSelector && (
                <p className="text-xs text-muted-foreground mt-1">
                  Sync folder: <strong>{settings.syncSelector}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && outlookConnected ? (
              <>
                <Badge variant="secondary">Connected</Badge>
                <Button variant="outline" size="sm" onClick={onOpenSettingsModal}>
                  <Settings2 className="h-4 w-4 mr-1" />
                  Email sync settings
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => void handleConnect('outlook')}>
                Connect
              </Button>
            )}
          </div>
        </div>

        {mailProvider === 'gmail' && healthQuery.data && (
          <p className="text-xs text-muted-foreground px-4">
            Webhook ready: {healthQuery.data.ok ? 'Yes' : 'No'} · CRM labels:{' '}
            {healthQuery.data.crmLabelCount} · Watch expires:{' '}
            {healthQuery.data.gmailWatchExpiry ?? 'not set'}
          </p>
        )}

        <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 opacity-60">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-green-500" />
            <div>
              <h4 className="font-medium">Salesforce</h4>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled>
            Connect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
