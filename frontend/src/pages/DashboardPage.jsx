import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar as CalendarIcon, Phone, Flame } from "lucide-react";
import SyllabusUpload from "@/components/SyllabusUpload";
import UrgencyBanner from "@/components/UrgencyBanner";
import CoursesLegend from "@/components/CoursesLegend";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [calls, setCalls] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const [e, c, q, cl] = await Promise.all([
        api.get("/events"),
        api.get("/courses"),
        api.get("/quizzes"),
        api.get("/calls"),
      ]);
      setEvents(e.data);
      setCourses(c.data);
      setQuizzes(q.data);
      setCalls(cl.data);
    } catch (err) {
      console.error("Dashboard refresh failed", err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Dashboard
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
            Hey, {user?.name?.split(" ")[0] || "student"} <span className="inline-block animate-ringWiggle">👋</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Drop your syllabi, generate quizzes, and let the AI tutor call you.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate("/quiz")} data-testid="shortcut-quiz">
            <Sparkles className="h-4 w-4 mr-2" /> Quiz Studio
          </Button>
          <Button onClick={() => navigate("/calls")} className="shadow-pop" data-testid="shortcut-call">
            <Phone className="h-4 w-4 mr-2" /> Call me now
          </Button>
        </div>
      </header>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        <StatCard label="Deadlines" value={events.length} icon={CalendarIcon} tint="#0EA5E9" testid="stat-deadlines" />
        <StatCard label="Courses" value={courses.length} icon={Flame} tint="#F97316" testid="stat-courses" />
        <StatCard label="Quizzes" value={quizzes.length} icon={Sparkles} tint="#22C55E" testid="stat-quizzes" />
        <StatCard label="Calls" value={calls.length} icon={Phone} tint="#EC4899" testid="stat-calls" />
      </motion.div>

      {/* Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        <div className="lg:col-span-7">
          <SyllabusUpload onComplete={refresh} />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <UrgencyBanner events={events} courses={courses} />
          <CoursesLegend courses={courses} />
        </div>
      </div>

      {/* Mini calendar preview */}
      <Card className="rounded-card border border-border bg-card shadow-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Your semester
            </div>
            <h2 className="font-heading text-xl sm:text-2xl tracking-tight">
              Calendar at a glance
            </h2>
          </div>
          <Button variant="ghost" onClick={() => navigate("/calendar")} data-testid="open-calendar">
            Open full calendar
          </Button>
        </div>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No events yet — upload a syllabus to populate.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {events.slice(0, 8).map((ev) => (
              <li key={ev.id} className="py-2 flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: ["#0EA5E9", "#22C55E", "#F59E0B", "#EC4899", "#14B8A6", "#8B5CF6", "#F97316"][
                      (courses.find((c) => c.id === ev.course_id)?.color_index ?? 0) % 7
                    ],
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{ev.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {ev.course_code} · {ev.due_date}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="text-center text-[11px] text-muted-foreground pt-2">
        Powered by <span className="font-semibold">AWS Cognito</span> · <span className="font-semibold">AWS S3</span> · <span className="font-semibold">Gemini 2.5 Pro</span> · <span className="font-semibold">Vapi.ai</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tint, testid }) {
  return (
    <Card
      className="rounded-card border border-border bg-card shadow-soft p-4 hover:shadow-pop ui-fade"
      data-testid={testid}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="h-7 w-7 rounded-lg grid place-items-center" style={{ background: tint + "22", color: tint }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 font-heading text-3xl sm:text-4xl font-semibold">{value}</div>
    </Card>
  );
}
