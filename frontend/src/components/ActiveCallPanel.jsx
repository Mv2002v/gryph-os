import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Phone, PhoneOff, X, CheckCircle2, Trophy,
} from "lucide-react";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { toast } from "sonner";

const STAGES = [
  { key: "queued",      label: "Queued" },
  { key: "ringing",     label: "Ringing" },
  { key: "in-progress", label: "On call" },
  { key: "ended",       label: "Completed" },
];

const STATUS_TO_FRIENDLY = {
  queued: "queued",
  scheduled: "queued",
  ringing: "ringing",
  "in-progress": "in-progress",
  forwarding: "in-progress",
  ended: "ended",
  failed: "ended",
  canceled: "ended",
};

const ENDED_STATUSES = new Set(["ended", "failed", "canceled", "timeout"]);

function percentTint(pct) {
  if (pct == null) return null;
  if (pct >= 70) return { bg: "#DCFCE7", text: "#14532D" };
  if (pct >= 40) return { bg: "#FEF9C3", text: "#713F12" };
  return { bg: "#FEE2E2", text: "#7F1D1D" };
}

function getHeroIcon(ended, percent) {
  if (!ended) return Phone;
  if (percent != null) return Trophy;
  return CheckCircle2;
}

function getHeadline(ended, percent, friendly) {
  if (ended) {
    if (percent != null) return `You scored ${percent}%`;
    return "All done!";
  }
  if (friendly === "in-progress") return "On the call";
  if (friendly === "ringing") return "Ringing…";
  return "Connecting…";
}

export default function ActiveCallPanel({ session, onClose, quizzes, onScored }) {
  const status = session?.status || "queued";
  const ended = ENDED_STATUSES.has(status);
  const friendly = useMemo(
    () => STATUS_TO_FRIENDLY[status] || status,
    [status]
  );
  const quiz = (quizzes || []).find((q) => q.id === session.quiz_id);
  const HeroIcon = getHeroIcon(ended, session.percent);
  const heroColor = ended
    ? session.percent != null ? "text-amber-400" : "text-emerald-400"
    : "text-primary";

  const triggerScore = async () => {
    try {
      const { data } = await api.post(`/calls/${session.id}/score`);
      onScored?.(data);
      toast.success("Scored!");
    } catch (e) {
      console.error("Score request failed", e);
      toast.error("Could not score yet (need transcript)");
    }
  };

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
            <HeroIcon className={`h-12 w-12 relative ${heroColor} ${!ended ? "animate-ringWiggle" : ""}`} />
          </div>
          <div className="mt-6 text-xs uppercase tracking-widest text-white/60">
            {ended ? "Call ended" : "AI tutor calling"}
          </div>
          <div className="mt-1 font-heading text-2xl sm:text-3xl" data-testid="active-call-status">
            {getHeadline(ended, session.percent, friendly)}
          </div>
          <div className="mt-1 text-sm text-white/70">
            {quiz?.title || session.quiz_title} · {session.phone}
          </div>

          <Stepper friendly={friendly} ended={ended} />

          {!ended && <Waveform />}

          {ended && session.percent != null && (
            <ScoreSummary session={session} />
          )}

          {session.transcript && <TranscriptBlock transcript={session.transcript} />}

          {ended && session.transcript && session.percent == null && (
            <Button
              onClick={triggerScore}
              className="mt-5 rounded-control bg-primary hover:bg-primary/90"
              data-testid="active-call-score-button"
            >
              <Trophy className="h-4 w-4 mr-2" /> Score this call
            </Button>
          )}

          <FooterActions ended={ended} onClose={onClose} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stepper({ friendly, ended }) {
  const reachedIndex = STAGES.findIndex((s) => s.key === friendly);
  return (
    <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
      {STAGES.map((s, i) => {
        const reached = reachedIndex >= i || (ended && s.key === "ended");
        const cls = reached
          ? "bg-primary/20 text-primary border-primary/30"
          : "bg-white/5 text-white/50 border-white/10";
        return (
          <span
            key={s.key}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border ${cls}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${reached ? "bg-primary" : "bg-white/30"}`} />
            {s.label}
          </span>
        );
      })}
    </div>
  );
}

const WAVE_BARS = Array.from({ length: 28 }, (_, i) => ({
  id: `bar-${i}`,
  height: 8 + (i % 5) * 8,
  delay: i * 70,
  duration: 700 + (i % 4) * 200,
}));

function Waveform() {
  return (
    <div className="mt-7 flex items-end justify-center gap-1 h-16" data-testid="active-call-waveform">
      {WAVE_BARS.map((b) => (
        <span
          key={b.id}
          className="w-1.5 rounded-full bg-primary/80 bar-dance"
          style={{
            height: `${b.height}px`,
            animationDelay: `${b.delay}ms`,
            animationDuration: `${b.duration}ms`,
          }}
        />
      ))}
    </div>
  );
}

function ScoreSummary({ session }) {
  return (
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
      <TopicLists strong={session.strong_topics} weak={session.weak_topics} />
      <Breakdown breakdown={session.breakdown} />
    </div>
  );
}

function TopicLists({ strong, weak }) {
  if (!strong?.length && !weak?.length) return null;
  return (
    <div className="grid sm:grid-cols-2 gap-2 mt-3">
      {strong?.length > 0 && (
        <div className="rounded-control border border-emerald-500/20 bg-emerald-500/10 p-3">
          <div className="text-[10px] uppercase tracking-widest text-emerald-300 mb-1">Strong</div>
          <ul className="text-xs space-y-1">
            {strong.map((t) => <li key={`s-${t}`}>• {t}</li>)}
          </ul>
        </div>
      )}
      {weak?.length > 0 && (
        <div className="rounded-control border border-rose-500/20 bg-rose-500/10 p-3">
          <div className="text-[10px] uppercase tracking-widest text-rose-300 mb-1">Review</div>
          <ul className="text-xs space-y-1">
            {weak.map((t) => <li key={`w-${t}`}>• {t}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Breakdown({ breakdown }) {
  if (!breakdown?.length) return null;
  return (
    <div
      className="mt-3 rounded-control border border-white/10 bg-black/30 divide-y divide-white/10"
      data-testid="call-results-breakdown"
    >
      {breakdown.map((b) => (
        <div key={`bd-${b.index ?? b.q}`} className="p-3 text-left">
          <div className="flex items-start gap-2">
            <span
              className={
                "mt-0.5 h-4 w-4 rounded-full grid place-items-center text-[10px] font-bold " +
                (b.is_correct ? "bg-emerald-500 text-emerald-900" : "bg-rose-500 text-rose-900")
              }
            >
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
  );
}

function TranscriptBlock({ transcript }) {
  return (
    <div className="mt-5 text-left">
      <div
        className="rounded-control border border-white/10 bg-black/40 p-3 max-h-56 overflow-auto"
        data-testid="call-results-transcript"
      >
        <div className="text-[10px] uppercase tracking-widest text-white/60 mb-1">Transcript</div>
        <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{transcript}</pre>
      </div>
    </div>
  );
}

function FooterActions({ ended, onClose }) {
  return (
    <>
      <div className="mt-7 flex items-center justify-center gap-3">
        {ended ? (
          <Button
            onClick={onClose}
            className="rounded-control bg-primary hover:bg-primary/90"
            data-testid="active-call-close-button"
          >
            Done
          </Button>
        ) : (
          <Button
            onClick={onClose} variant="destructive"
            className="rounded-control"
            data-testid="active-call-end-button"
          >
            <PhoneOff className="h-4 w-4 mr-2" /> Hide
          </Button>
        )}
      </div>
      <div className="mt-4 text-[10px] text-white/50 text-center">
        Scoring by Gemini · Voice via Vapi · Auth &amp; storage on AWS
      </div>
    </>
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

export { percentTint };
