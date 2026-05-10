import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Phone, PhoneCall, Clock, Calendar as CalIcon, Trash2,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { AnimatePresence } from "framer-motion";
import { fmtDate } from "@/lib/courseColors";
import ActiveCallPanel, { percentTint } from "@/components/ActiveCallPanel";

function normalizeE164(s) {
  if (!s) return "";
  const t = s.trim().replace(/[\s()-]/g, "");
  if (t.startsWith("+")) return t;
  if (/^\d{10}$/.test(t)) return "+1" + t;
  if (/^1\d{10}$/.test(t)) return "+" + t;
  return t;
}

function fmtTs(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function callIconStyle(status) {
  if (status === "ended")  return { background: "#DCFCE7", color: "#14532D" };
  if (status === "failed") return { background: "#FEE2E2", color: "#7F1D1D" };
  return { background: "#E0F2FE", color: "#075985" };
}

export default function CallCenterPage() {
  const { user, updateMe } = useAuth();
  const [params] = useSearchParams();

  const [quizzes, setQuizzes] = useState([]);
  const [calls, setCalls] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [quizId, setQuizId] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [schedNote, setSchedNote] = useState("");
  const [schedBusy, setSchedBusy] = useState(false);
  const pollRef = useRef(null);

  const refreshAll = useCallback(async () => {
    try {
      const [q, c, s] = await Promise.all([
        api.get("/quizzes"), api.get("/calls"), api.get("/schedule"),
      ]);
      setQuizzes(q.data);
      setCalls(c.data);
      setScheduled(s.data);
      return q.data;
    } catch (e) {
      console.error("refreshAll failed", e);
      return [];
    }
  }, []);

  const preselectFromUrl = useCallback(
    (qs) => {
      const pre = params.get("quiz");
      if (pre && qs.find((q) => q.id === pre)) setQuizId(pre);
      else if (qs?.length) setQuizId(qs[0].id);
    },
    [params]
  );

  useEffect(() => {
    refreshAll().then(preselectFromUrl);
  }, [refreshAll, preselectFromUrl]);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  const persistPhoneIfChanged = useCallback(
    async (e164) => {
      if (!user || !phone) return;
      if ((user.phone || "") === e164) return;
      try {
        await updateMe({ phone: e164 });
      } catch (e) {
        console.warn("Could not persist phone", e);
      }
    },
    [user, phone, updateMe]
  );

  const startPolling = useCallback(
    (sessionId) => {
      const poll = async () => {
        try {
          const r = await api.get(`/calls/${sessionId}`);
          setActive(r.data);
          if (["ended", "failed", "canceled"].includes(r.data?.status)) {
            clearInterval(pollRef.current);
            await refreshAll();
          }
        } catch (e) {
          console.warn("poll failed", e);
        }
      };
      pollRef.current = setInterval(poll, 4000);
      poll();
    },
    [refreshAll]
  );

  const startCall = useCallback(async () => {
    const e164 = normalizeE164(phone);
    if (!e164.startsWith("+") || e164.length < 10) {
      toast.error("Enter phone in E.164 (e.g., +14155552671)");
      return;
    }
    if (!quizId) { toast.error("Pick a quiz first"); return; }
    setBusy(true);
    try {
      await persistPhoneIfChanged(e164);
      const { data } = await api.post("/call/start", {
        quiz_id: quizId, phone: e164, name: user?.name,
      });
      toast.success("Calling now — your phone will ring");
      setActive({ id: data.session_id, status: data.status, vapi_call_id: data.call_id, quiz_id: quizId, phone: e164 });
      startPolling(data.session_id);
    } catch (err) {
      console.error("startCall failed", err);
      toast.error(err?.response?.data?.detail || "Could not start call");
    } finally {
      setBusy(false);
    }
  }, [phone, quizId, user?.name, persistPhoneIfChanged, startPolling]);

  const scheduleCall = useCallback(async () => {
    const e164 = normalizeE164(phone);
    if (!e164.startsWith("+") || e164.length < 10) { toast.error("Enter phone in E.164"); return; }
    if (!quizId)     { toast.error("Pick a quiz"); return; }
    if (!scheduleAt) { toast.error("Pick a date/time"); return; }
    setSchedBusy(true);
    try {
      const local = new Date(scheduleAt);
      const { data } = await api.post("/schedule", {
        quiz_id: quizId, phone: e164,
        when_iso: local.toISOString(),
        note: schedNote || null,
      });
      toast.success(`Scheduled for ${fmtTs(data.when_ts)}`);
      setScheduleAt(""); setSchedNote("");
      refreshAll();
    } catch (err) {
      console.error("schedule failed", err);
      toast.error(err?.response?.data?.detail || "Could not schedule");
    } finally {
      setSchedBusy(false);
    }
  }, [phone, quizId, scheduleAt, schedNote, refreshAll]);

  const cancelSchedule = useCallback(
    async (id) => {
      try {
        await api.delete(`/schedule/${id}`);
        toast.success("Canceled");
        refreshAll();
      } catch (e) {
        console.error("cancelSchedule failed", e);
        toast.error("Could not cancel");
      }
    },
    [refreshAll]
  );

  const deleteCall = useCallback(
    async (id) => {
      try {
        await api.delete(`/calls/${id}`);
        toast.success("Deleted");
        refreshAll();
      } catch (e) {
        console.error("deleteCall failed", e);
        toast.error("Could not delete");
      }
    },
    [refreshAll]
  );

  const minDateTime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const upcoming = scheduled.filter((s) => s.status === "scheduled");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Call Center</div>
        <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">Have the AI tutor call you</h1>
        <p className="text-muted-foreground mt-1">
          Pick a quiz, drop your number, and get quizzed by voice. Magic.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        <SetupCard
          phone={phone} setPhone={setPhone}
          quizId={quizId} setQuizId={setQuizId}
          quizzes={quizzes}
          busy={busy} startCall={startCall}
          scheduleAt={scheduleAt} setScheduleAt={setScheduleAt}
          schedNote={schedNote} setSchedNote={setSchedNote}
          schedBusy={schedBusy} scheduleCall={scheduleCall}
          minDateTime={minDateTime}
        />

        <div className="lg:col-span-7 space-y-4">
          {upcoming.length > 0 && (
            <ScheduledList items={upcoming} onCancel={cancelSchedule} />
          )}
          <CallsList calls={calls} onSelect={setActive} onDelete={deleteCall} />
        </div>
      </div>

      <AnimatePresence>
        {active && (
          <ActiveCallPanel
            session={active}
            quizzes={quizzes}
            onScored={(updated) => setActive(updated)}
            onClose={() => {
              clearInterval(pollRef.current);
              setActive(null);
              refreshAll();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SetupCard({
  phone, setPhone, quizId, setQuizId, quizzes,
  busy, startCall,
  scheduleAt, setScheduleAt, schedNote, setSchedNote,
  schedBusy, scheduleCall, minDateTime,
}) {
  return (
    <Card className="lg:col-span-5 rounded-card border border-border bg-card shadow-soft p-5 space-y-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">Setup the call</div>
      <div className="space-y-1.5">
        <Label>Phone number</Label>
        <Input
          value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="+14155552671"
          data-testid="call-me-phone-input"
          className="h-11 rounded-control"
        />
        <div className="text-[11px] text-muted-foreground">
          We use E.164 format. US 10-digit numbers auto-prefix with +1.
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Quiz</Label>
        <Select value={quizId} onValueChange={setQuizId}>
          <SelectTrigger data-testid="call-me-quiz-select" className="h-11">
            <SelectValue placeholder="Pick a quiz" />
          </SelectTrigger>
          <SelectContent>
            {quizzes.map((q) => (
              <SelectItem key={q.id} value={q.id}>
                {q.title} · {q.questions?.length || 0}q
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {quizzes.length === 0 && (
          <div className="text-xs text-muted-foreground">
            Generate a quiz first in Quiz Studio.
          </div>
        )}
      </div>

      <Tabs defaultValue="now" className="pt-2">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="now" data-testid="call-tab-now">Call now</TabsTrigger>
          <TabsTrigger value="schedule" data-testid="call-tab-schedule">Schedule</TabsTrigger>
        </TabsList>
        <TabsContent value="now" className="mt-4">
          <Button
            disabled={busy || !quizId}
            onClick={startCall}
            className="w-full h-12 sm:h-14 rounded-control shadow-pop ui-press text-base"
            data-testid="call-me-submit-button"
          >
            <PhoneCall className="h-5 w-5 mr-2" />
            {busy ? "Dialing…" : "Call me now"}
          </Button>
        </TabsContent>
        <TabsContent value="schedule" className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <CalIcon className="h-3.5 w-3.5" /> Date &amp; time
            </Label>
            <Input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              min={minDateTime}
              className="h-11"
              data-testid="schedule-when-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Input
              value={schedNote} onChange={(e) => setSchedNote(e.target.value)}
              placeholder="Pre-midterm cram"
              data-testid="schedule-note-input"
            />
          </div>
          <Button
            onClick={scheduleCall}
            disabled={schedBusy || !quizId || !scheduleAt}
            className="w-full h-11 rounded-control shadow-pop ui-press"
            data-testid="schedule-submit-button"
          >
            <Clock className="h-4 w-4 mr-2" />
            {schedBusy ? "Scheduling…" : "Schedule call"}
          </Button>
          <div className="text-[11px] text-muted-foreground text-center">
            Backend scheduler fires the call at your chosen time.
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
        Voice via <span className="font-semibold">Vapi.ai</span>
        <span className="mx-1">·</span>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Storage on <span className="font-semibold">AWS S3</span>
      </div>
    </Card>
  );
}

function ScheduledList({ items, onCancel }) {
  return (
    <Card className="rounded-card border border-border bg-card shadow-soft p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        Upcoming scheduled calls
      </div>
      <ul className="divide-y divide-border" data-testid="schedule-list">
        {items.map((s) => (
          <li key={s.id} className="py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 grid place-items-center">
              <Clock className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{s.quiz_title}</div>
              <div className="text-xs text-muted-foreground">
                {s.phone} · {fmtTs(s.when_ts)}{s.note ? ` · ${s.note}` : ""}
              </div>
            </div>
            <Button
              variant="ghost" size="icon"
              onClick={() => onCancel(s.id)}
              data-testid="schedule-cancel-button"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CallsList({ calls, onSelect, onDelete }) {
  return (
    <Card className="rounded-card border border-border bg-card shadow-soft p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        Recent calls
      </div>
      {calls.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No calls yet. Start one from the left panel.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {calls.map((c) => (
            <CallRow key={c.id} call={c} onSelect={onSelect} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function CallRow({ call, onSelect, onDelete }) {
  const tint = percentTint(call.percent);
  const dateLabel = fmtDate(
    new Date(call.created_at * 1000).toISOString().slice(0, 10)
  );
  return (
    <li
      className="py-3 flex items-center gap-3 hover:bg-secondary/40 ui-fade rounded-control px-2"
      data-testid="call-history-row"
    >
      <button
        onClick={() => onSelect(call)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <div
          className="h-9 w-9 rounded-xl grid place-items-center shrink-0"
          style={callIconStyle(call.status)}
        >
          <Phone className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate flex items-center gap-2">
            {call.quiz_title}
            {tint && (
              <span
                className="text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                style={{ background: tint.bg, color: tint.text }}
              >
                {call.percent}%
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {call.phone} · {dateLabel}
          </div>
        </div>
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {call.status}
        </span>
      </button>
      <Button
        variant="ghost" size="icon"
        className="text-rose-600 hover:bg-rose-50"
        onClick={(e) => { e.stopPropagation(); onDelete(call.id); }}
        data-testid="call-history-delete" title="Delete call"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
