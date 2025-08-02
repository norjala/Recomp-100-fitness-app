import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

// Pages
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Leaderboard from "@/pages/leaderboard";
import Profile from "@/pages/profile";
import Upload from "@/pages/upload";
import NotFound from "@/pages/not-found";

// Layout
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RegistrationModal } from "@/components/registration-modal";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showRegistration, setShowRegistration] = useState(false);

  // Show registration modal if user is authenticated but hasn't registered for competition
  const needsRegistration = isAuthenticated && user && !user.name;

  return (
    <div className="min-h-screen bg-gray-50">
      {isLoading || !isAuthenticated ? (
        <Switch>
          <Route path="/" component={Landing} />
          <Route component={Landing} />
        </Switch>
      ) : (
        <>
          <Header />
          <div className="pb-16 md:pb-0">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/leaderboard" component={Leaderboard} />
              <Route path="/profile" component={Profile} />
              <Route path="/upload" component={Upload} />
              <Route component={NotFound} />
            </Switch>
          </div>
          <MobileNav />
          
          {needsRegistration && (
            <RegistrationModal 
              isOpen={true}
              onClose={() => setShowRegistration(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
