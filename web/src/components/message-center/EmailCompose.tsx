import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { mailApiBase } from '@/lib/provider';
import { useAuth } from '@/hooks/useAuth';
import type { InboxMessage, MailProvider, ReplyContext } from '@/types';

interface EmailComposeProps {
  provider: MailProvider;
  initial?: Partial<ReplyContext>;
}

export function EmailCompose({ provider, initial }: EmailComposeProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [to, setTo] = useState(initial?.to ?? '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');

  const sendMutation = useMutation({
    mutationFn: () =>
      api<{ messageId: string; threadId?: string; rfcMessageId?: string }>(
        `${mailApiBase(provider)}/send`,
        {
          method: 'POST',
          body: JSON.stringify({
            to,
            cc: cc || undefined,
            subject,
            body,
            inReplyTo: initial?.inReplyTo,
            gmailThreadId: initial?.gmailThreadId,
          }),
        }
      ),
    onSuccess: (result) => {
      const optimistic: InboxMessage = {
        id: `optimistic-${result.messageId}`,
        subject,
        preview: body.slice(0, 120),
        from: user?.email ?? 'You',
        email: to,
        company: '',
        timestamp: new Date().toISOString(),
        direction: 'sent',
        gmailThreadId: result.threadId ?? initial?.gmailThreadId ?? null,
        gmailMessageId: result.messageId,
        bodyText: body,
        rfcMessageId: result.rfcMessageId ?? null,
      };
      queryClient.setQueriesData<{ messages: InboxMessage[] }>(
        { queryKey: ['messages'] },
        (old) => (old ? { messages: [optimistic, ...old.messages] } : { messages: [optimistic] })
      );
      toast.success('Email sent');
      setTo('');
      setCc('');
      setSubject('');
      setBody('');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'reauth_required') {
        toast.error('Session expired. Reconnect in Settings.');
      } else {
        toast.error('Failed to send email');
      }
    },
  });

  const handleSend = () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error('To, subject, and message are required');
      return;
    }
    sendMutation.mutate();
  };

  return (
    <Card className="bg-gradient-surface border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Compose Email
        </CardTitle>
        <CardDescription>Create a new email message</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">To</label>
            <Input
              placeholder="recipient@company.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">CC</label>
            <Input
              placeholder="cc@company.com"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Subject</label>
          <Input
            placeholder="Email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Message</label>
          <Textarea
            placeholder="Type your message here..."
            className="min-h-48"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="flex justify-end pt-4">
          <Button
            className="bg-gradient-primary text-primary-foreground hover:opacity-90"
            onClick={handleSend}
            disabled={sendMutation.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMutation.isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
