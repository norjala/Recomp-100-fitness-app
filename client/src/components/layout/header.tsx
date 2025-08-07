import { Link, useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Plus } from "lucide-react";

export function Header() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  if (!user) {
    return null;
  }

  const navItems = [
    { href: "/", label: "Dashboard", id: "dashboard" },
    { href: "/leaderboard", label: "Leaderboard", id: "leaderboard" },
    { href: "/profile", label: "My Profile", id: "profile" },
    { href: "/upload", label: "Upload Scan", id: "upload" },
  ];

  const isActive = (href: string) => {
    if (href === "/" && location === "/") return true;
    if (href !== "/" && location.startsWith(href)) return true;
    return false;
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link href="/">
                <h1 className="text-2xl font-bold text-primary cursor-pointer">
                  <Trophy className="inline h-6 w-6 mr-2" />
                  💯 Day Recomp
                </h1>
              </Link>
            </div>
            <nav className="hidden md:ml-10 md:flex space-x-8">
              {navItems.map((item) => (
                <Link key={item.id} href={item.href}>
                  <span
                    className={`px-1 pt-1 pb-4 text-sm font-medium transition-colors cursor-pointer ${
                      isActive(item.href)
                        ? "text-primary border-b-2 border-primary"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <Link href="/upload" className="hidden md:block">
              <Button 
                className="bg-secondary text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Scan
              </Button>
            </Link>
            <Link href="/upload" className="md:hidden">
              <Button size="sm" className="bg-secondary text-white hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center space-x-2 md:space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage 
                  src={user.profileImageUrl || undefined} 
                  alt={user.name || 'User'}
                />
                <AvatarFallback>
                  {(user.name || user.firstName || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium text-gray-700">
                {user.firstName || user.name || 'User'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 text-xs md:text-sm"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
