import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const LOGO_SRC = '/lovable-uploads/0b9c7f97-1df2-4153-bbff-77746b7573aa.png';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
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

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col px-6 py-8">
        <header className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="FlyCRM" className="h-10 w-10 rounded-lg object-contain" />
            <span className="text-xl font-bold gradient-text">FlyCRM</span>
          </Link>
        </header>

        <main className="flex flex-1 flex-col justify-center py-12">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </main>
      </div>
    </div>
  );
}
