import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BookOpen, Sparkles, Calendar, Phone } from "lucide-react";

export default function AuthPage() {
  const { login, signup, demo } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await signup(email, password, name);
      }
      toast.success("Welcome to StudySpark!");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  const goDemo = async () => {
    setBusy(true);
    try {
      await demo();
      toast.success("Continuing as demo — enjoy!");
      navigate("/", { replace: true });
    } catch {
      toast.error("Demo unavailable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 bg-blob">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-pop">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <div className="font-heading text-2xl font-semibold">StudySpark</div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              ace your semester
            </div>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="font-heading text-4xl font-semibold tracking-tight">
            Drop your syllabi.
            <br />
            We’ll <span className="text-primary">do the rest</span>.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Auto-extract every deadline, generate quizzes from study material, and get
            quizzed by an AI tutor over a real phone call.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            <Feature icon={Calendar} label="Live calendar" tint="#0EA5E9" />
            <Feature icon={Sparkles} label="AI quizzes" tint="#22C55E" />
            <Feature icon={Phone} label="Voice tutor" tint="#EC4899" />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Built for hackathon demos — powered by Gemini + Vapi.
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md p-6 sm:p-8 rounded-card border border-border bg-card shadow-soft">
          <div className="flex items-center gap-2 lg:hidden mb-4">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-pop">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="font-heading text-xl font-semibold">StudySpark</div>
          </div>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login" data-testid="auth-tab-login">Log in</TabsTrigger>
              <TabsTrigger value="signup" data-testid="auth-tab-signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="mt-6">
              <form onSubmit={submit} className="space-y-4">
                <Field id="email" type="email" label="Email" value={email} onChange={setEmail} testid="auth-email-input" />
                <Field id="password" type="password" label="Password" value={password} onChange={setPassword} testid="auth-password-input" />
                <Button type="submit" disabled={busy} className="w-full h-11 ui-press shadow-pop" data-testid="auth-submit-button">
                  {busy ? "Logging in…" : "Log in"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={submit} className="space-y-4">
                <Field id="name" label="Name (optional)" value={name} onChange={setName} testid="auth-name-input" />
                <Field id="email2" type="email" label="Email" value={email} onChange={setEmail} testid="auth-email-input" />
                <Field id="password2" type="password" label="Password (min 6)" value={password} onChange={setPassword} testid="auth-password-input" />
                <Button type="submit" disabled={busy} className="w-full h-11 ui-press shadow-pop" data-testid="auth-submit-button">
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="secondary"
            className="w-full h-11 ui-press"
            disabled={busy}
            onClick={goDemo}
            data-testid="auth-demo-bypass-button"
          >
            Continue as demo
          </Button>
          <p className="mt-4 text-[11px] text-center text-muted-foreground">
            Demo bypass is for testing only. Email login still works.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Field({ id, label, type = "text", value, onChange, testid }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-control"
        data-testid={testid}
      />
    </div>
  );
}

function Feature({ icon: Icon, label, tint }) {
  return (
    <div className="rounded-card border border-border bg-card p-3 shadow-soft">
      <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ background: tint + "22", color: tint }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-sm font-medium">{label}</div>
    </div>
  );
}
