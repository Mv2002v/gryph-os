import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SemesterProvider } from "@/contexts/SemesterContext";
import AppShell from "@/components/Layout/AppShell";
import DashboardPage from "@/pages/DashboardPage";
import CalendarPage from "@/pages/CalendarPage";
import SettingsPage from "@/pages/SettingsPage";
import OnboardingFlow from "@/pages/OnboardingFlow";
import { Toaster } from "@/components/ui/sonner";

function LoadingStage() {
  return (
    <div className="stage" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        letterSpacing: "0.22em",
        color: "var(--gos-cyan)",
        textTransform: "uppercase",
      }}>
        LOADING…
      </div>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingStage />;
  // Not logged in → full onboarding flow
  if (!user) return <Navigate to="/onboarding" replace />;
  // Logged in but never finished onboarding → resume onboarding
  if (user.onboarded === false) return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SemesterProvider>
          <Routes>
            {/* Full cinematic onboarding — Boot → Hero → Auth → Profile → Upload → Extraction → Dashboard */}
            <Route path="/onboarding" element={<OnboardingFlow />} />

            {/* /auth redirects to /onboarding (AuthPage is superseded by OnboardingFlow's auth scene) */}
            <Route path="/auth" element={<Navigate to="/onboarding" replace />} />

            {/* Protected app shell */}
            <Route
              element={
                <Protected>
                  <AppShell />
                </Protected>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster richColors position="top-center" />
        </SemesterProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
