import { useLocation } from "wouter";
import { Home, Trophy, FileText } from "lucide-react";

export function MobileNav() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/leaderboard", icon: Trophy, label: "Leaderboard" },
    { path: "/my-scans", icon: FileText, label: "My Scans" },
  ];

  return (
    <div className="mobile-nav">
      <div className="flex">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`mobile-nav-item ${
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-gray-600 hover:text-primary hover:bg-gray-50"
              }`}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}