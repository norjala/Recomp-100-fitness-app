import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";

// Pages
import AuthPage from "@/pages/auth-page";
import VerifyEmailPage from "@/pages/verify-email";
import Dashboard from "@/pages/dashboard";
import Leaderboard from "@/pages/leaderboard";
import Profile from "@/pages/profile";
import Upload from "@/pages/upload";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

// Layout
import { VerifiedRoute } from "@/lib/protected-route";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

function Router() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 pb-16 md:pb-0">
              <Switch>
                <VerifiedRoute path="/" component={Dashboard} />
                <VerifiedRoute path="/leaderboard" component={Leaderboard} />
                <VerifiedRoute path="/profile" component={Profile} />
                <VerifiedRoute path="/upload" component={Upload} />
                <VerifiedRoute path="/admin" component={AdminPage} />
                <Route component={NotFound} />
              </Switch>
            </main>
            <MobileNav />
          </div>
        </Route>
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

