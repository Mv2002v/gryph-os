import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { COURSE_PALETTE, fmtDate, eventTypeLabel, classnames } from "@/lib/courseColors";
import api from "@/lib/api";
import { toast } from "sonner";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(year, month) { return new Date(year, month, 1); }
function monthGrid(year, month) {
  const first = startOfMonth(year, month);
  const startDow = first.getDay();
  const days = [];
  // Padding before
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, inMonth: false });
  }
  // current month
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    days.push({ date: new Date(year, month, d), inMonth: true });
  }
  // pad to 42
  while (days.length < 42) {
    const last2 = days[days.length - 1].date;
    days.push({ date: new Date(last2.getFullYear(), last2.getMonth(), last2.getDate() + 1), inMonth: false });
  }
  return days;
}

function iso(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function DeadlinesCalendar({ events, courses, onChanged }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(null);

  const courseColor = (courseId) => {
    const c = courses.find((x) => x.id === courseId);
    return COURSE_PALETTE[(c?.color_index ?? 0) % COURSE_PALETTE.length];
  };

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const ev of events || []) {
      if (!ev.due_date) continue;
      (map[ev.due_date] = map[ev.due_date] || []).push(ev);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

  const goPrev = () => {
    const d = new Date(cursor.y, cursor.m - 1, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goNext = () => {
    const d = new Date(cursor.y, cursor.m + 1, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => setCursor({ y: today.getFullYear(), m: today.getMonth() });

  const remove = async (id) => {
    try {
      await api.delete(`/events/${id}`);
      toast.success("Deleted");
      onChanged?.();
      setSelected(null);
    } catch (e) {
      toast.error("Could not delete");
    }
  };

  return (
    <Card
      className="rounded-card border border-border bg-card shadow-soft p-3 sm:p-5"
      data-testid="deadlines-calendar"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goPrev} data-testid="calendar-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-heading text-lg sm:text-2xl tracking-tight min-w-[160px] text-center">
            {MONTHS[cursor.m]} {cursor.y}
          </div>
          <Button variant="ghost" size="icon" onClick={goNext} data-testid="calendar-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={goToday} data-testid="calendar-today">
          Today
        </Button>
      </div>

      <div className="grid grid-cols-7 text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
        {WEEK.map((w) => (
          <div key={w} className="px-2 py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {grid.map(({ date, inMonth }, i) => {
          const key = iso(date);
          const dayEvents = eventsByDay[key] || [];
          const isToday = iso(today) === key;
          return (
            <div
              key={i}
              className={classnames(
                "relative rounded-control border bg-card min-h-[92px] sm:min-h-[110px] p-1.5 sm:p-2 ui-fade",
                inMonth ? "border-border" : "border-border/60 bg-secondary/30",
                isToday && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={classnames(
                    "text-xs sm:text-sm font-medium",
                    inMonth ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {date.getDate()}
                </span>
                {dayEvents.length > 2 && (
                  <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 2).map((ev) => {
                  const c = courseColor(ev.course_id);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSelected(ev)}
                      className="w-full text-left truncate rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-medium border ui-press"
                      style={{ background: c.bg, color: c.text, borderColor: c.border }}
                      data-testid="calendar-event-chip"
                      title={ev.title}
                    >
                      {ev.title}
                    </button>
                  );
                })}
                {dayEvents.length > 2 && (
                  <button
                    onClick={() => setSelected(dayEvents[2])}
                    className="w-full text-left truncate rounded-full px-2 py-0.5 text-[10px] font-medium bg-secondary text-foreground border border-border"
                  >
                    +{dayEvents.length - 2} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="rounded-card">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                  style={(() => {
                    const c = courseColor(selected.course_id);
                    return { background: c.bg, color: c.text, borderColor: c.border };
                  })()}
                >
                  {selected.course_code}
                </span>
                <span className="text-muted-foreground">{eventTypeLabel(selected.type)}</span>
                <span className="text-muted-foreground">· {fmtDate(selected.due_date)}</span>
              </div>
              {selected.notes && (
                <p className="text-muted-foreground">{selected.notes}</p>
              )}
              <div className="pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => remove(selected.id)}
                  data-testid="calendar-event-delete"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
