import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { CrmContact } from '@/types';

interface ApolloContactsPanelProps {
  onCompose: (contact: { to: string; name?: string | null }) => void;
  onOpenSettings: () => void;
}

function displayName(contact: CrmContact): string {
  return contact.name?.trim() || contact.email;
}

export function ApolloContactsPanel({ onCompose, onOpenSettings }: ApolloContactsPanelProps) {
  const [search, setSearch] = useState('');

  const contactsQuery = useQuery({
    queryKey: ['contacts', 'apollo'],
    queryFn: () =>
      api<{ contacts: CrmContact[] }>('/api/contacts?createdFrom=apollo&limit=200'),
  });

  const contacts = useMemo(() => {
    const list = contactsQuery.data?.contacts ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.name?.toLowerCase().includes(q) ?? false)
    );
  }, [contactsQuery.data?.contacts, search]);

  return (
    <Card className="bg-gradient-surface border-border/50 h-fit lg:sticky lg:top-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Apollo contacts
        </CardTitle>
        <CardDescription>Click a contact to compose an email</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search Apollo contacts..."
            className="pl-9 bg-background/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {contactsQuery.isLoading && (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        )}

        {contactsQuery.isError && (
          <p className="text-sm text-destructive py-4 text-center">Failed to load contacts</p>
        )}

        {!contactsQuery.isLoading && !contactsQuery.isError && contacts.length === 0 && (
          <div className="text-center py-6 space-y-2">
            <p className="text-sm text-muted-foreground">No Apollo contacts yet</p>
            <Button variant="outline" size="sm" onClick={onOpenSettings}>
              Connect Apollo in Settings
            </Button>
          </div>
        )}

        <ul className="max-h-[420px] overflow-y-auto space-y-1">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                onClick={() => onCompose({ to: contact.email, name: contact.name })}
                className="w-full flex items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/40 transition-colors"
              >
                <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{displayName(contact)}</span>
                  <span className="block text-xs text-muted-foreground truncate">{contact.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
