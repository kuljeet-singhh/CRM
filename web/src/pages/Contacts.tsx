import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Search, Mail, Calendar, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/preferences';
import type { CrmContact, ContactSource } from '@/types';

function sourceLabel(source: ContactSource): string {
  if (source === 'apollo') return 'Apollo';
  if (source === 'linkedin_csv') return 'LinkedIn';
  if (source === 'logged_email') return 'Email';
  return 'Manual';
}

function sourceBadgeVariant(source: ContactSource): 'default' | 'secondary' | 'outline' {
  if (source === 'apollo') return 'default';
  if (source === 'linkedin_csv') return 'default';
  if (source === 'logged_email') return 'secondary';
  return 'outline';
}

function displayName(contact: CrmContact): string {
  return contact.name?.trim() || contact.email || 'Unknown contact';
}

function initials(contact: CrmContact): string {
  const name = contact.name?.trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
  return contact.email?.[0]?.toUpperCase() ?? 'L';
}

export default function Contacts() {
  const { formatRelativeTime } = useFormatters();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const contactsQuery = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '200' });
      if (search.trim()) params.set('search', search.trim());
      return api<{ contacts: CrmContact[] }>(`/api/contacts?${params.toString()}`);
    },
  });

  const contacts = contactsQuery.data?.contacts;

  const stats = useMemo(() => {
    const list = contacts ?? [];
    const apollo = list.filter((c) => c.createdFrom === 'apollo').length;
    const linkedin = list.filter((c) => c.createdFrom === 'linkedin_csv').length;
    const email = list.filter((c) => c.createdFrom === 'logged_email').length;
    return { total: list.length, apollo, linkedin, email };
  }, [contacts]);

  function runSearch() {
    setSearch(searchInput.trim());
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Contacts</h1>
          <p className="text-muted-foreground">
            {stats.total} contact{stats.total === 1 ? '' : 's'}
            {stats.apollo > 0 ? ` · ${stats.apollo} from Apollo` : ''}
            {stats.linkedin > 0 ? ` · ${stats.linkedin} from LinkedIn` : ''}
            {stats.email > 0 ? ` · ${stats.email} from email` : ''}
          </p>
        </div>
      </div>

      <Card className="bg-gradient-surface border-border/50">
        <CardContent className="p-4">
          <form
            className="flex gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-10 bg-background/50"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {contactsQuery.isLoading && (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading contacts…</p>
      )}

      {contactsQuery.isError && (
        <p className="text-sm text-destructive py-8 text-center">Failed to load contacts.</p>
      )}

      {!contactsQuery.isLoading && !contactsQuery.isError && (contacts?.length ?? 0) === 0 && (
        <Card className="bg-gradient-surface border-border/50">
          <CardContent className="py-12 text-center space-y-2">
            <Users className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">No contacts yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Import from Apollo or upload LinkedIn Connections.csv in Settings, or sync email in
              Message Center to create contacts automatically.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {(contacts ?? []).map((contact) => (
          <Card
            key={contact.id}
            className="hover-glow transition-all duration-300 bg-gradient-surface border-border/50"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground font-semibold text-sm">
                    {initials(contact)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate">{displayName(contact)}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {contact.title || contact.company || contact.email || 'No email'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={sourceBadgeVariant(contact.createdFrom)}>
                  {sourceLabel(contact.createdFrom)}
                </Badge>
                {contact.emailCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {contact.emailCount} email{contact.emailCount === 1 ? '' : 's'}
                  </Badge>
                )}
              </div>

              {contact.email ? (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{contact.email}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">No email</span>
                </div>
              )}

              {contact.linkedinUrl && (
                <a
                  href={contact.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span className="truncate">LinkedIn profile</span>
                </a>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">
                  {contact.lastEmailAt
                    ? `Last email ${formatRelativeTime(contact.lastEmailAt)}`
                    : 'No emails logged yet'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
