import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useReopenSettingsModal } from '@/hooks/useReopenSettingsModal';
import { EmailInbox } from '@/components/message-center/EmailInbox';
import { EmailCompose } from '@/components/message-center/EmailCompose';
import { EmailTemplates } from '@/components/message-center/EmailTemplates';
import { SettingsModal } from '@/components/settings/SettingsModal';
import type { ReplyContext } from '@/types';

export default function Email() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('inbox');
  const [composeInitial, setComposeInitial] = useState<Partial<ReplyContext> | undefined>();
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const openSettingsModal = useCallback(() => setSettingsModalOpen(true), []);

  useReopenSettingsModal(openSettingsModal, Boolean(user));

  useEffect(() => {
    if (searchParams.get('openSettings') !== '1') return;
    const next = new URLSearchParams(searchParams);
    next.delete('openSettings');
    setSearchParams(next, { replace: true });
    setSettingsModalOpen(true);
  }, [searchParams, setSearchParams]);

  const handleReply = (ctx: ReplyContext) => {
    setComposeInitial(ctx);
    setTab('compose');
  };

  const handleComposeFromContact = (contact: { to: string; name?: string | null }) => {
    setComposeInitial({ to: contact.to, subject: '', body: '' });
    setTab('compose');
  };

  const handleUseTemplate = (template: { subject: string; body: string }) => {
    setComposeInitial({ subject: template.subject, body: template.body });
    setTab('compose');
  };

  if (!user) return null;

  const mailProvider = user.mailProvider;

  if (!mailProvider) {
    return (
      <div className="p-6">
        <Card className="mx-auto max-w-lg border-border/50 bg-gradient-surface">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Connect your inbox</CardTitle>
            <CardDescription>
              Link Gmail or Outlook in Settings to sync messages and use Email Center.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild className="bg-gradient-primary text-primary-foreground">
              <Link to="/settings">Go to Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Email Center</h1>
          <p className="text-muted-foreground">Manage your client communications efficiently</p>
        </div>
        <Button
          className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-accent"
          onClick={() => {
            setComposeInitial(undefined);
            setTab('compose');
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Compose
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-96">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <EmailInbox
            provider={mailProvider}
            onReply={handleReply}
            onCompose={handleComposeFromContact}
            onOpenSyncSettings={openSettingsModal}
          />
        </TabsContent>

        <TabsContent value="compose">
          <EmailCompose
            key={JSON.stringify(composeInitial)}
            provider={mailProvider}
            initial={composeInitial}
          />
        </TabsContent>

        <TabsContent value="templates">
          <EmailTemplates onUseTemplate={handleUseTemplate} />
        </TabsContent>
      </Tabs>

      <SettingsModal
        open={settingsModalOpen}
        provider={mailProvider}
        onClose={() => setSettingsModalOpen(false)}
        onWiped={() => queryClient.invalidateQueries({ queryKey: ['messages'] })}
        onContactsChanged={() => queryClient.invalidateQueries({ queryKey: ['contacts'] })}
      />
    </div>
  );
}
