import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Phone, PhoneCall, PhoneOff, X, CheckCircle2, Clock, Calendar as CalIcon,
  Trash2, Trophy,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { fmtDate } from "@/lib/courseColors";

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

  const refreshAll = async () => {
    const [q, c, s] = await Promise.all([
      api.get("/quizzes"),
      api.get("/calls"),
      api.get("/schedule"),
    ]);
    setQuizzes(q.data);
    setCalls(c.data);
    setScheduled(s.data);
    return q.data;
  };

  useEffect(() => {
    refreshAll().then((qs) => {
      const pre = params.get("quiz");
      if (pre && qs.find((q) => q.id === pre)) setQuizId(pre);
      else if (qs?.length) setQuizId(qs[0].id);
    });
  }, []);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const startCall = async () => {
    const e164 = normalizeE164(phone);
    if (!e164.startsWith("+") || e164.length < 10) {
      toast.error("Enter phone in E.164 (e.g., +14155552671)");
      return;
    }
    if (!quizId) { toast.error("Pick a quiz first"); return; }
    setBusy(true);
    try {
      if (user && phone && (user.phone || "") !== e164) {
        try { await updateMe({ phone: e164 }); } catch {}
      }
      const { data } = await api.post("/call/start", {
        quiz_id: quizId, phone: e164, name: user?.name,
      });
      toast.success("Calling now — your phone will ring");
      const session = { id: data.session_id, status: data.status, vapi_call_id: data.call_id };
      setActive(session);
      const poll = async () => {
        try {
          const r = await api.get(`/calls/${data.session_id}`);
          setActive(r.data);
          if (["ended", "failed", "canceled"].includes(r.data?.status)) {
            clearInterval(pollRef.current);
            refreshAll();
          }
        } catch {}
      };
      pollRef.current = setInterval(poll, 4000);
      poll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not start call");
    } finally {
      setBusy(false);
    }
  };

  const scheduleCall = async () => {
    const e164 = normalizeE164(phone);
    if (!e164.startsWith("+") || e164.length < 10) {
      toast.error("Enter phone in E.164"); return;
    }
    if (!quizId) { toast.error("Pick a quiz"); return; }
    if (!scheduleAt) { toast.error("Pick a date/time"); return; }
    setSchedBusy(true);
    try {
      // datetime-local is in the user's local time; convert to ISO with tz
      const local = new Date(scheduleAt);
      const iso = local.toISOString();
      const { data } = await api.post("/schedule", {
        quiz_id: quizId, phone: e164, when_iso: iso, note: schedNote || null,
      });
      toast.success(`Scheduled for ${fmtTs(data.when_ts)}`);
      setScheduleAt(""); setSchedNote("");
      refreshAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not schedule");
    } finally {
      setSchedBusy(false);
    }
  };

  const cancelSchedule = async (id) => {
    try {
      await api.delete(`/schedule/${id}`);
      toast.success("Canceled");
      refreshAll();
    } catch {
      toast.error("Could not cancel");
    }
  };

  const minDateTime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Call Center
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
          Have the AI tutor call you
        </h1>
        <p className="text-muted-foreground mt-1">
          Pick a quiz, drop your number, and get quizzed by voice. Magic.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        <Card className="lg:col-span-5 rounded-card border border-border bg-card shadow-soft p-5 space-y-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Setup the call
          </div>
          <div className="space-y-1.5">
            <Label>Phone number</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
                  value={schedNote}
                  onChange={(e) => setSchedNote(e.target.value)}
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

        <div className="lg:col-span-7 space-y-4">
          {/* Scheduled list */}
          {scheduled.length > 0 && (
            <Card className="rounded-card border border-border bg-card shadow-soft p-5">
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Upcoming scheduled calls
              </div>
              <ul className="divide-y divide-border" data-testid="schedule-list">
                {scheduled.filter((s) => s.status === "scheduled").map((s) => (
                  <li key={s.id} className="py-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 grid place-items-center">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.quiz_title}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.phone} · {fmtTs(s.when_ts)}
                        {s.note ? ` · ${s.note}` : ""}
                      </div>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => cancelSchedule(s.id)}
                      data-testid="schedule-cancel-button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
                {scheduled.filter((s) => s.status === "scheduled").length === 0 && (
                  <li className="py-3 text-sm text-muted-foreground">No upcoming calls.</li>
                )}
              </ul>
            </Card>
          )}

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
                  <li
                    key={c.id}
                    className="py-3 flex items-center gap-3 cursor-pointer hover:bg-secondary/40 ui-fade rounded-control px-2"
                    onClick={() => setActive(c)}
                    data-testid="call-history-row"
                  >
                    <div
                      className="h-9 w-9 rounded-xl grid place-items-center"
                      style={
                        c.status === "ended"
                          ? { background: "#DCFCE7", color: "#14532D" }
                          : c.status === "failed"
                          ? { background: "#FEE2E2", color: "#7F1D1D" }
                          : { background: "#E0F2FE", color: "#075985" }
                      }
                    >
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        {c.quiz_title}
                        {c.percent != null && (
                          <span
                            className="text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                            style={{
                              background: c.percent >= 70 ? "#DCFCE7" : c.percent >= 40 ? "#FEF9C3" : "#FEE2E2",
                              color: c.percent >= 70 ? "#14532D" : c.percent >= 40 ? "#713F12" : "#7F1D1D",
                            }}
                          >
                            {c.percent}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.phone} · {fmtDate(new Date(c.created_at * 1000).toISOString().slice(0, 10))}
                      </div>
                    </div>
                    <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      {c.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {active && (
          <ActiveCallPanel
            session={active}
            onClose={() => {
              clearInterval(pollRef.current);
              setActive(null);
              refreshAll();
            }}
            quizzes={quizzes}
            onScored={(updated) => setActive(updated)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ActiveCallPanel({ session, onClose, quizzes, onScored }) {
  const ended = ["ended", "failed", "canceled", "timeout"].includes(session?.status);
  const status = session?.status || "queued";
  const quiz = quizzes.find((q) => q.id === session.quiz_id);

  const stages = [
    { key: "queued", label: "Queued" },
    { key: "ringing", label: "Ringing" },
    { key: "in-progress", label: "On call" },
    { key: "ended", label: "Completed" },
  ];
  const friendly = useMemo(() => {
    const map = {
      queued: "queued", scheduled: "queued",
      "in-progress": "in-progress", ringing: "ringing",
      forwarding: "in-progress",
      ended: "ended", failed: "ended", canceled: "ended",
    };
    return map[status] || status;
  }, [status]);

  const triggerScore = async () => {
    try {
      const { data } = await api.post(`/calls/${session.id}/score`);
      onScored?.(data);
      toast.success("Scored!");
    } catch (e) {
      toast.error("Could not score yet (need transcript)");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl rounded-card border border-white/10 bg-[#0B1020] text-white shadow-[0_30px_80px_rgba(0,0,0,0.55)] overflow-hidden max-h-[90vh] overflow-y-auto"
        data-testid="active-call-panel"
      >
        <button
          onClick={onClose}
          className="sticky top-3 ml-auto mr-3 p-2 rounded-full hover:bg-white/10 ui-fade z-10 block"
          aria-label="close" data-testid="active-call-close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="px-8 pb-8 sm:px-10 sm:pb-10 -mt-8 text-center">
          <div className="mx-auto h-32 w-32 rounded-full bg-white/5 border border-white/10 grid place-items-center relative">
            <div
              className={"absolute inset-0 rounded-full " + (ended ? "opacity-30" : "animate-callPulse")}
              style={{ background: "radial-gradient(circle, rgba(14,165,233,0.5) 0%, transparent 70%)" }}
            />
            {ended ? (
              session.percent != null ? (
                <Trophy className="h-12 w-12 text-amber-400 relative" />
              ) : (
                <CheckCircle2 className="h-12 w-12 text-emerald-400 relative" />
              )
            ) : (
              <Phone className="h-12 w-12 text-primary relative animate-ringWiggle" />
            )}
          </div>
          <div className="mt-6 text-xs uppercase tracking-widest text-white/60">
            {ended ? "Call ended" : "AI tutor calling"}
          </div>
          <div className="mt-1 font-heading text-2xl sm:text-3xl" data-testid="active-call-status">
            {ended
              ? (session.percent != null ? `You scored ${session.percent}%` : "All done!")
              : friendly === "in-progress" ? "On the call"
              : friendly === "ringing" ? "Ringing…"
              : "Connecting…"}
          </div>
          <div className="mt-1 text-sm text-white/70">
            {quiz?.title || session.quiz_title} · {session.phone}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            {stages.map((s, i) => {
              const reached = stages.findIndex((x) => x.key === friendly) >= i || (ended && s.key === "ended");
              return (
                <span
                  key={s.key}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border " +
                    (reached
                      ? "bg-primary/20 text-primary border-primary/30"
                      : "bg-white/5 text-white/50 border-white/10")
                  }
                >
                  <span className={"h-1.5 w-1.5 rounded-full " + (reached ? "bg-primary" : "bg-white/30")} />
                  {s.label}
                </span>
              );
            })}
          </div>

          {!ended && (
            <div className="mt-7 flex items-end justify-center gap-1 h-16" data-testid="active-call-waveform">
              {[...Array(28)].map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-primary/80 bar-dance"
                  style={{
                    height: 8 + (i % 5) * 8 + "px",
                    animationDelay: i * 70 + "ms",
                    animationDuration: 700 + (i % 4) * 200 + "ms",
                  }}
                />
              ))}
            </div>
          )}

          {/* Score panel */}
          {ended && session.percent != null && (
            <div className="mt-7 text-left" data-testid="call-results-score">
              <div className="grid grid-cols-3 gap-2">
                <ScoreTile label="Score" value={`${session.score ?? 0}/${session.total ?? "—"}`} tint="#22C55E" />
                <ScoreTile label="Percent" value={`${session.percent}%`} tint="#0EA5E9" />
                <ScoreTile label="Status" value={session.status} tint="#FF4D8D" />
              </div>
              {session.summary && (
                <div className="rounded-control border border-white/10 bg-white/5 p-3 mt-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1">Summary</div>
                  <div className="text-sm">{session.summary}</div>
                </div>
              )}
              {(session.weak_topics?.length || session.strong_topics?.length) && (
                <div className="grid sm:grid-cols-2 gap-2 mt-3">
                  {session.strong_topics?.length > 0 && (
                    <div className="rounded-control border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-emerald-300 mb-1">Strong</div>
                      <ul className="text-xs space-y-1">
                        {session.strong_topics.map((t, i) => <li key={i}>• {t}</li>)}
                      </ul>
                    </div>
                  )}
                  {session.weak_topics?.length > 0 && (
                    <div className="rounded-control border border-rose-500/20 bg-rose-500/10 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-rose-300 mb-1">Review</div>
                      <ul className="text-xs space-y-1">
                        {session.weak_topics.map((t, i) => <li key={i}>• {t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {session.breakdown?.length > 0 && (
                <div className="mt-3 rounded-control border border-white/10 bg-black/30 divide-y divide-white/10" data-testid="call-results-breakdown">
                  {session.breakdown.map((b, i) => (
                    <div key={i} className="p-3 text-left">
                      <div className="flex items-start gap-2">
                        <span className={"mt-0.5 h-4 w-4 rounded-full grid place-items-center text-[10px] font-bold " + (b.is_correct ? "bg-emerald-500 text-emerald-900" : "bg-rose-500 text-rose-900")}>
                          {b.is_correct ? "✓" : "✗"}
                        </span>
                        <div className="flex-1 text-sm">
                          <div className="font-medium">{b.q}</div>
                          <div className="text-xs text-white/60 mt-0.5">
                            Correct: <span className="text-white/90">{b.correct_answer}</span>
                          </div>
                          {b.student_answer && (
                            <div className="text-xs text-white/60">
                              You said: <span className="text-white/90">{b.student_answer}</span>
                            </div>
                          )}
                          {b.note && <div className="text-xs text-white/50 mt-1 italic">{b.note}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(session.transcript) && (
            <div className="mt-5 text-left">
              <div className="rounded-control border border-white/10 bg-black/40 p-3 max-h-56 overflow-auto" data-testid="call-results-transcript">
                <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1">Transcript</div>
                <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{session.transcript}</pre>
              </div>
            </div>
          )}

          {ended && session.transcript && session.percent == null && (
            <Button
              onClick={triggerScore}
              className="mt-5 rounded-control bg-primary hover:bg-primary/90"
              data-testid="active-call-score-button"
            >
              <Trophy className="h-4 w-4 mr-2" /> Score this call
            </Button>
          )}

          <div className="mt-7 flex items-center justify-center gap-3">
            {!ended ? (
              <Button onClick={onClose} variant="destructive" className="rounded-control" data-testid="active-call-end-button">
                <PhoneOff className="h-4 w-4 mr-2" /> Hide
              </Button>
            ) : (
              <Button onClick={onClose} className="rounded-control bg-primary hover:bg-primary/90" data-testid="active-call-close-button">
                Done
              </Button>
            )}
          </div>
          <div className="mt-4 text-[10px] text-white/50 text-center">
            Scoring by Gemini · Voice via Vapi · Auth & storage on AWS
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ScoreTile({ label, value, tint }) {
  return (
    <div className="rounded-control border border-white/10 bg-white/5 p-2.5">
      <div className="text-[10px] uppercase tracking-widest" style={{ color: tint }}>{label}</div>
      <div className="font-heading text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}
