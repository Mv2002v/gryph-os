import React, { useCallback, useEffect, useState } from "react";
import DeadlinesCalendar from "@/components/DeadlinesCalendar";
import CoursesLegend from "@/components/CoursesLegend";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { fmtDate, daysUntil, urgencyColor, eventTypeLabel } from "@/lib/courseColors";
import { useSemester } from "../contexts/SemesterContext";

export default function CalendarPage() {
  const { activeSemesterId } = useSemester();
  const [events, setEvents] = useState([]);
  const [courses, setCourses] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const [e, c] = await Promise.all([
        api.get("/events", {
          params: activeSemesterId ? { semester_id: activeSemesterId } : {}
        }),
        api.get("/courses", {
          params: activeSemesterId ? { semester_id: activeSemesterId } : {}
        }),
      ]);
      setEvents(e.data);
      setCourses(c.data);
    } catch (err) {
      console.error("Calendar refresh failed", err);
    }
  }, [activeSemesterId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Calendar
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
          Your semester at a glance
        </h1>
      </header>
      <CoursesLegend courses={courses} />
      <Tabs defaultValue="month" data-testid="calendar-view-toggle">
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>
        <TabsContent value="month" className="mt-4">
          {events.length === 0 ? (
            <Card className="rounded-card border border-border bg-card shadow-soft p-4">
              <div style={{textAlign:'center', padding:'40px 20px', color:'var(--gos-muted)'}}>
                <p style={{fontFamily:'JetBrains Mono', fontSize:13, marginBottom:8}}>
                  NO SYLLABI UPLOADED
                </p>
                <p style={{fontSize:14}}>
                  Upload your course outlines to populate this semester's calendar.
                </p>
              </div>
            </Card>
          ) : (
            <DeadlinesCalendar events={events} courses={courses} onChanged={refresh} />
          )}
        </TabsContent>
        <TabsContent value="list" className="mt-4">
          <Card className="rounded-card border border-border bg-card shadow-soft p-4">
            {events.length === 0 ? (
              <div style={{textAlign:'center', padding:'40px 20px', color:'var(--gos-muted)'}}>
                <p style={{fontFamily:'JetBrains Mono', fontSize:13, marginBottom:8}}>
                  NO SYLLABI UPLOADED
                </p>
                <p style={{fontSize:14}}>
                  Upload your course outlines to populate this semester's calendar.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {events.map((ev) => {
                  const u = urgencyColor(daysUntil(ev.due_date));
                  return (
                    <li key={ev.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {ev.title}{" "}
                          <span className="text-muted-foreground font-normal">· {ev.course_code}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {eventTypeLabel(ev.type)} · {fmtDate(ev.due_date)}
                        </div>
                      </div>
                      {u && (
                        <span
                          className="text-xs font-semibold rounded-full px-2.5 py-1"
                          style={{ background: u.color + "22", color: u.color }}
                        >
                          {u.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
