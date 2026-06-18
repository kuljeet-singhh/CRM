import { Link } from 'react-router-dom';
import { Mail, RefreshCw, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const LOGO_SRC = '/lovable-uploads/0b9c7f97-1df2-4153-bbff-77746b7573aa.png';

const FEATURES = [
  {
    icon: Mail,
    title: 'Message Center',
    description: 'Send, receive, and manage client emails in one unified inbox.',
  },
  {
    icon: RefreshCw,
    title: 'Real-time sync',
    description: 'Gmail and Outlook messages sync automatically to your CRM.',
  },
  {
    icon: Target,
    title: 'Pipeline & contacts',
    description: 'Track deals, contacts, and conversations without switching tools.',
  },
] as const;

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-32 h-80 w-80 rounded-full bg-accent/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="FlyCRM" className="h-10 w-10 rounded-lg object-contain" />
            <span className="text-xl font-bold gradient-text">FlyCRM</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/sign-in">Sign in</Link>
            </Button>
            <Button asChild className="bg-gradient-primary text-primary-foreground">
              <Link to="/sign-up">Sign up</Link>
            </Button>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-12 py-12">
          <section className="max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Your CRM,{' '}
              <span className="gradient-text">connected to your inbox</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              Sign up with email or connect Gmail/Outlook to send, sync, and manage client
              communications without leaving FlyCRM.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" asChild className="bg-gradient-primary text-primary-foreground">
                <Link to="/sign-up">Get started free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/sign-in">Sign in</Link>
              </Button>
            </div>
          </section>

          <section className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                className="bg-gradient-surface border-border/50 hover-glow transition-shadow duration-300"
              >
                <CardHeader className="pb-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </section>
        </main>

        <footer className="py-6 text-center text-sm text-muted-foreground">
          FlyCRM — AI-powered CRM for modern sales teams
        </footer>
      </div>
    </div>
  );
}
