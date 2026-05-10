import React from "react";
import { Card } from "@/components/ui/card";
import { AlarmClock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fmtDate, daysUntil, urgencyColor, eventTypeLabel } from "@/lib/courseColors";
import { Button } from "@/components/ui/button";

export default function UrgencyBanner({ events, courses }) {
  const navigate = useNavigate();
  const upcoming = (events || [])
    .map((e) => ({ ...e, days: daysUntil(e.due_date) }))
    .filter((e) => e.days != null && e.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  if (!upcoming.length) {
    return (
      <Card
        className="rounded-card border border-border bg-card shadow-soft p-5"
        data-testid="urgency-banner"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-secondary grid place-items-center">
            <AlarmClock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="font-heading text-lg">All clear</div>
            <div className="text-sm text-muted-foreground">
              Upload a syllabus to populate your calendar.
            </div>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card
      className="rounded-card border border-border bg-card shadow-soft p-5"
      data-testid="urgency-banner"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            What’s coming up
          </div>
          <h3 className="font-heading text-lg sm:text-xl">Next deadlines</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate("/calendar")}
          data-testid="urgency-view-calendar"
        >
          View calendar <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
      <ul className="space-y-2">
        {upcoming.map((ev) => {
          const u = urgencyColor(ev.days);
          const course = (courses || []).find((c) => c.id === ev.course_id);
          const dot = course ? course.color_index : 0;
          return (
            <li
              key={ev.id}
              className="flex items-center gap-3 rounded-control border border-border bg-secondary/30 px-3 py-2.5"
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: ["#0EA5E9", "#22C55E", "#F59E0B", "#EC4899", "#14B8A6", "#8B5CF6", "#F97316"][dot % 7] }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {ev.title}{" "}
                  <span className="text-muted-foreground font-normal">
                    · {ev.course_code}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {eventTypeLabel(ev.type)} · {fmtDate(ev.due_date)}
                </div>
              </div>
              <span
                className="text-xs font-semibold rounded-full px-2.5 py-1"
                style={{ background: u.color + "22", color: u.color }}
              >
                {u.label}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
