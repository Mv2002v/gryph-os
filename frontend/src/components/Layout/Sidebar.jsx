import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Calendar, Sparkles, Phone, LayoutDashboard, LogOut, Settings, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { classnames } from "@/lib/courseColors";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/calendar", label: "Calendar", icon: Calendar, testid: "nav-calendar" },
  { to: "/quiz", label: "Quiz Studio", icon: Sparkles, testid: "nav-quiz" },
  { to: "/calls", label: "Call Center", icon: Phone, testid: "nav-calls" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-pop">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <div className="font-heading text-lg font-semibold leading-none">StudySpark</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            ace your semester
          </div>
        </div>
      </div>
      <nav className="px-2 py-2 space-y-1">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            data-testid={n.testid}
            end={n.to === "/"}
            className={({ isActive }) =>
              classnames(
                "flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium ui-fade",
                isActive
                  ? "bg-secondary text-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )
            }
          >
            <n.icon className="h-4 w-4" />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-3 border-t border-border">
        <div className="px-2 pb-2 space-y-1">
          <div className="text-xs text-muted-foreground">Logged in as</div>
          <div className="text-sm font-medium truncate">{user?.name || user?.email}</div>
          {user?.auth_source && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={"inline-block h-1.5 w-1.5 rounded-full " + (user.auth_source === "cognito" ? "bg-emerald-500" : "bg-amber-500")} />
              {user.auth_source === "cognito" ? "AWS Cognito" : "Demo session"}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={async () => {
            await logout();
            navigate("/auth", { replace: true });
          }}
          data-testid="sidebar-logout-button"
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </aside>
  );
}

export function MobileTabbar() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border">
      <div className="grid grid-cols-5">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            data-testid={`m-${n.testid}`}
            className={({ isActive }) =>
              classnames(
                "py-2.5 grid place-items-center text-[11px] gap-1 ui-fade",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <n.icon className="h-5 w-5" />
            <span>{n.label.split(" ")[0]}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
