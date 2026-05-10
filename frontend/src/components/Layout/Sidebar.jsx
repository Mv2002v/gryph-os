import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { GryphLogo } from "@/components/ui/GryphLogo";
import { Orb } from "@/components/ui/Orb";

const NAV_WORKSPACE = [
  { to: "/", label: "Dashboard", testid: "nav-dashboard" },
  { to: "/calendar", label: "Calendar", testid: "nav-calendar" },
];

const NAV_ACCOUNT = [
  { to: "/settings", label: "Settings", testid: "nav-settings" },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="dash-side">
      <div style={{ padding: "6px 6px 4px" }}>
        <GryphLogo size="sm" />
      </div>

      <div>
        <div className="section-title" style={{ marginBottom: 8 }}>Workspace</div>
        <nav>
          {NAV_WORKSPACE.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testid}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
            >
              <span className="ic" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div>
        <div className="section-title" style={{ marginBottom: 8 }}>Account</div>
        <nav>
          {NAV_ACCOUNT.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testid}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
            >
              <span className="ic" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div style={{
        marginTop: "auto",
        padding: 12,
        borderRadius: 12,
        background: "rgba(34,211,238,0.06)",
        border: "1px solid rgba(34,211,238,0.25)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <Orb size={32} state="idle" />
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          color: "var(--gos-text-2)",
          textTransform: "uppercase",
          lineHeight: 1.4,
          flex: 1,
          minWidth: 0,
        }}>
          <div style={{ color: "var(--gos-cyan)" }}>AI · Online</div>
          <div style={{
            color: "var(--gos-muted)",
            fontSize: 9,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {user?.name || user?.email || "User"}
          </div>
        </div>
        <button
          onClick={async () => { await logout(); navigate("/auth", { replace: true }); }}
          data-testid="sidebar-logout-button"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            color: "var(--gos-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            textTransform: "uppercase",
            padding: 0,
            flexShrink: 0,
          }}
        >
          Exit
        </button>
      </div>
    </aside>
  );
}

export function MobileTabbar() {
  const ALL_NAV = [...NAV_WORKSPACE, ...NAV_ACCOUNT];
  return (
    <nav style={{
      display: "flex",
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 30,
      background: "rgba(255,255,255,0.95)",
      borderTop: "1px solid var(--gos-border)",
      backdropFilter: "blur(12px)",
    }}>
      {ALL_NAV.map(n => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === "/"}
          data-testid={`m-${n.testid}`}
          style={({ isActive }) => ({
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "14px 0",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: isActive ? "var(--gos-cyan)" : "var(--gos-muted)",
            textDecoration: "none",
          })}
        >
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}
