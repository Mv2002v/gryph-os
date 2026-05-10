import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, PhoneCall, PhoneOff, X, CheckCircle2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

export default function CallCenterPage() {
  const { user, updateMe } = useAuth();
  const [params] = useSearchParams();
  const [quizzes, setQuizzes] = useState([]);
  const [calls, setCalls] = useState([]);
  const [quizId, setQuizId] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [active, setActive] = useState(null); // active call session
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    api.get("/quizzes").then((r) => {
      setQuizzes(r.data);
      const pre = params.get("quiz");
      if (pre && r.data.find((q) => q.id === pre)) setQuizId(pre);
      else if (r.data?.length) setQuizId(r.data[0].id);
    });
    api.get("/calls").then((r) => setCalls(r.data));
  }, []);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const startCall = async () => {
    const e164 = normalizeE164(phone);
    if (!e164.startsWith("+") || e164.length < 10) {
      toast.error("Enter phone in E.164 (e.g., +14155552671)");
      return;
    }
    if (!quizId) {
      toast.error("Pick a quiz first");
      return;
    }
    setBusy(true);
    try {
      // persist phone for next time
      if (user && phone && (user.phone || "") !== e164) {
        try { await updateMe({ phone: e164 }); } catch {}
      }
      const { data } = await api.post("/call/start", {
        quiz_id: quizId,
        phone: e164,
        name: user?.name,
      });
      toast.success("Calling now — your phone will ring");
      const session = { id: data.session_id, status: data.status, vapi_call_id: data.call_id };
      setActive(session);
      // poll
      const poll = async () => {
        try {
          const r = await api.get(`/calls/${data.session_id}`);
          setActive(r.data);
          if (["ended", "failed", "canceled"].includes(r.data?.status)) {
            clearInterval(pollRef.current);
            api.get("/calls").then((rr) => setCalls(rr.data));
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
              We use E.164 format. US 10-digit numbers will be auto-prefixed with +1.
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
          <Button
            disabled={busy || !quizId}
            onClick={startCall}
            className="w-full h-12 sm:h-14 rounded-control shadow-pop ui-press text-base"
            data-testid="call-me-submit-button"
          >
            <PhoneCall className="h-5 w-5 mr-2" />
            {busy ? "Dialing…" : "Call me now"}
          </Button>
        </Card>

        <Card className="lg:col-span-7 rounded-card border border-border bg-card shadow-soft p-5">
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
                    <div className="text-sm font-medium truncate">{c.quiz_title}</div>
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

      <AnimatePresence>
        {active && (
          <ActiveCallPanel
            session={active}
            onClose={() => {
              clearInterval(pollRef.current);
              setActive(null);
              api.get("/calls").then((rr) => setCalls(rr.data));
            }}
            quizzes={quizzes}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ActiveCallPanel({ session, onClose, quizzes }) {
  const ended = ["ended", "failed", "canceled", "timeout"].includes(session?.status);
  const status = session?.status || "queued";
  const quiz = quizzes.find((q) => q.id === session.quiz_id);

  const stages = [
    { key: "queued",   label: "Queued" },
    { key: "ringing",  label: "Ringing" },
    { key: "in-progress", label: "On call" },
    { key: "ended",    label: "Completed" },
  ];
  const friendly = useMemo(() => {
    const map = {
      queued: "queued",
      "scheduled": "queued",
      "in-progress": "in-progress",
      "ringing": "ringing",
      "forwarding": "in-progress",
      "ended": "ended",
      "failed": "ended",
      "canceled": "ended",
    };
    return map[status] || status;
  }, [status]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl rounded-card border border-white/10 bg-[#0B1020] text-white shadow-[0_30px_80px_rgba(0,0,0,0.55)] overflow-hidden"
        data-testid="active-call-panel"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-white/10 ui-fade"
          aria-label="close"
          data-testid="active-call-close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="p-8 sm:p-10 text-center">
          <div className="mx-auto h-32 w-32 rounded-full bg-white/5 border border-white/10 grid place-items-center relative">
            <div
              className={
                "absolute inset-0 rounded-full " +
                (ended ? "opacity-30" : "animate-callPulse")
              }
              style={{
                background: "radial-gradient(circle, rgba(14,165,233,0.5) 0%, transparent 70%)",
              }}
            />
            {ended ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-400 relative" />
            ) : (
              <Phone className="h-12 w-12 text-primary relative animate-ringWiggle" />
            )}
          </div>
          <div className="mt-6 text-xs uppercase tracking-widest text-white/60">
            {ended ? "Call ended" : "AI tutor calling"}
          </div>
          <div
            className="mt-1 font-heading text-2xl sm:text-3xl"
            data-testid="active-call-status"
          >
            {ended ? "All done!" : friendly === "in-progress" ? "On the call" : friendly === "ringing" ? "Ringing…" : "Connecting…"}
          </div>
          <div className="mt-1 text-sm text-white/70">
            {quiz?.title || session.quiz_title} · {session.phone}
          </div>

          {/* Status stepper */}
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
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " + (reached ? "bg-primary" : "bg-white/30")
                    }
                  />
                  {s.label}
                </span>
              );
            })}
          </div>

          {/* Waveform */}
          {!ended && (
            <div
              className="mt-7 flex items-end justify-center gap-1 h-16"
              data-testid="active-call-waveform"
            >
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

          {/* Transcript + summary */}
          {(session.transcript || session.summary) && (
            <div className="mt-7 text-left">
              {session.summary && (
                <div className="rounded-control border border-white/10 bg-white/5 p-3 mb-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1">
                    Summary
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{session.summary}</div>
                </div>
              )}
              {session.transcript && (
                <div
                  className="rounded-control border border-white/10 bg-black/40 p-3 max-h-56 overflow-auto"
                  data-testid="call-results-transcript"
                >
                  <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1">
                    Transcript
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
{session.transcript}
                  </pre>
                </div>
              )}
            </div>
          )}

          <div className="mt-7 flex items-center justify-center gap-3">
            {!ended ? (
              <Button
                onClick={onClose}
                variant="destructive"
                className="rounded-control"
                data-testid="active-call-end-button"
              >
                <PhoneOff className="h-4 w-4 mr-2" /> Hide
              </Button>
            ) : (
              <Button
                onClick={onClose}
                className="rounded-control bg-primary hover:bg-primary/90"
                data-testid="active-call-close-button"
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
