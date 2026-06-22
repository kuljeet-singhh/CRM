import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { PreferencesProvider } from "@/lib/preferences";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { OAuthTokenHandler } from "@/components/auth/OAuthTokenHandler";
import { useSessionRefresh } from "@/hooks/useSessionRefresh";
import { AppShell } from "@/components/layout/AppShell";
import Landing from "./pages/Landing";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Contacts from "./pages/Contacts";
import Companies from "./pages/Companies";
import Pipeline from "./pages/Pipeline";
import Tasks from "./pages/Tasks";
import Email from "./pages/Email";
import Reports from "./pages/Reports";
import AI from "./pages/AI";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
    },
  },
});

function AppRoutes() {
  useSessionRefresh();

  return (
    <>
      <OAuthTokenHandler />
      <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<Index />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/email" element={<Email />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/ai" element={<AI />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark">
      <PreferencesProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
      </PreferencesProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
