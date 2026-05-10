import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, updateMe } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateMe({ name, phone });
      toast.success("Saved");
    } catch (e) {
      toast.error("Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Settings
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">Profile</h1>
      </header>
      <Card className="rounded-card border border-border bg-card shadow-soft p-5 space-y-4">
        <div>
          <Label>Email</Label>
          <Input value={user?.email || ""} disabled className="h-11" />
        </div>
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11" data-testid="settings-name-input" />
        </div>
        <div>
          <Label>Phone (E.164)</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+14155552671"
            className="h-11"
            data-testid="settings-phone-input"
          />
        </div>
        <Button onClick={save} disabled={busy} className="shadow-pop ui-press" data-testid="settings-save-button">
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </Card>
    </div>
  );
}
