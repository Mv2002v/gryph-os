import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSemester } from "@/contexts/SemesterContext";
import AddCourse from "@/components/AddCourse";

const COURSE_COLORS = ["cs", "math", "phys", "eng", "bus"];
const COLOR_MAP = {
  cs: "var(--c-cs)",
  math: "var(--c-math)",
  phys: "var(--c-phys)",
  eng: "var(--c-eng)",
  bus: "var(--c-bus)",
};

function buildMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) {
    cells.push({ day: prevDays - startDay + 1 + i, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, outside: false });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - daysInMonth + 1, outside: true });
  }
  return cells;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeSemesterId } = useSemester();
  const [events, setEvents] = useState([]);
  const [courses, setCourses] = useState([]);

  const now = new Date();
  const cells = useMemo(() => buildMonthCells(now.getFullYear(), now.getMonth()), []);
  const today = now.getDate();
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const refresh = useCallback(async () => {
    try {
      const [e, c] = await Promise.all([
        api.get("/events", { params: activeSemesterId ? { semester_id: activeSemesterId } : {} }),
        api.get("/courses", { params: activeSemesterId ? { semester_id: activeSemesterId } : {} }),
      ]);
      setEvents(e.data);
      setCourses(c.data);
    } catch (err) {
      console.error("Dashboard refresh failed", err);
    }
  }, [activeSemesterId]);

  useEffect(() => { refresh(); }, [refresh]);

  const upcoming = events
    .filter(ev => ev.due_date && new Date(ev.due_date) >= now)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 6);

  const nextDeadlineHours = upcoming.length
    ? Math.round((new Date(upcoming[0].due_date) - now) / (1000 * 60 * 60))
    : null;

  function courseColor(courseId) {
    const idx = courses.findIndex(c => c.id === courseId);
    return COURSE_COLORS[idx >= 0 ? idx % COURSE_COLORS.length : 0];
  }

  return (
    <div className="dash-main" style={{ overflow: "hidden auto" }}>

      {/* ── Stats row ── */}
      <div className="dash-stats">
        <div className="bento stat-card fade-up" data-testid="stat-deadlines">
          <div className="v">{events.length}</div>
          <div className="l">Deadlines This Sem</div>
        </div>
        <div className="bento stat-card fade-up d1" data-testid="stat-courses">
          <div className="v">
            <span className="acc">{String(courses.length).padStart(2, "0")}</span>
          </div>
          <div className="l">Active Courses</div>
        </div>
        <div className="bento stat-card fade-up d2">
          <div className="v">
            {user?.target_gpa
              ? <>{user.target_gpa}<span style={{ fontSize: 18, color: "var(--gos-muted)" }}> GPA</span></>
              : <span style={{ color: "var(--gos-dim)", fontSize: 22 }}>—</span>}
          </div>
          <div className="l">Target GPA</div>
        </div>
        <div className="bento stat-card fade-up d3">
          <div className="v">
            {nextDeadlineHours !== null
              ? <>{nextDeadlineHours}<span style={{ fontSize: 18, color: "var(--gos-muted)" }}>h</span></>
              : <span style={{ color: "var(--gos-dim)", fontSize: 22 }}>—</span>}
          </div>
          <div className="l">Until Next Deadline</div>
        </div>
      </div>

      {/* ── Calendar bento (left) ── */}
      <div className="bento dash-cal fade-up d2">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h4 style={{ margin: 0 }}>{monthName}</h4>
          <button
            onClick={() => navigate("/calendar")}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.2em",
              color: "var(--gos-cyan)", background: "none",
              border: "1px solid rgba(34,211,238,0.4)", borderRadius: 999,
              padding: "4px 12px", cursor: "pointer",
            }}
          >
            Full →
          </button>
        </div>
        <div className="cal-grid">
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <div key={i} className="dow">{d}</div>
          ))}
          {cells.map((c, i) => {
            const isToday = !c.outside && c.day === today;
            const dayEvents = !c.outside ? events.filter(ev => {
              if (!ev.due_date) return false;
              const d = new Date(ev.due_date);
              return (
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear() &&
                d.getDate() === c.day
              );
            }) : [];
            return (
              <div
                key={i}
                className={`cell${c.outside ? " outside" : ""}${isToday ? " today" : ""}`}
              >
                <div className="num">{c.day}</div>
                {dayEvents.slice(0, 2).map((ev, ei) => (
                  <div
                    key={ei}
                    className={`event ${courseColor(ev.course_id)}`}
                    style={{ animationDelay: `${ei * 100}ms` }}
                    title={ev.title}
                  >
                    {(ev.title || "").slice(0, 8)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right column ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18, minHeight: 0, overflow: "hidden auto" }}>

        {/* Upcoming deadlines */}
        <div className="bento fade-up d3">
          <h4>Upcoming · Deadlines</h4>
          {upcoming.length === 0 ? (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--gos-muted)", letterSpacing: "0.18em",
              textAlign: "center", padding: "20px 0", textTransform: "uppercase",
            }}>
              No deadlines yet<br />
              <span style={{ fontSize: 10, opacity: 0.7 }}>Upload syllabi below</span>
            </div>
          ) : (
            <div className="up-list">
              {upcoming.map((ev, i) => {
                const colorKey = courseColor(ev.course_id);
                const color = COLOR_MAP[colorKey];
                const dueDate = new Date(ev.due_date).toLocaleDateString("en-US", {
                  month: "short", day: "numeric",
                });
                return (
                  <div key={ev.id || i} className="up-item">
                    <span className="dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "var(--font-mono)", fontSize: 10,
                        letterSpacing: "0.18em", color, textTransform: "uppercase",
                      }}>
                        {ev.course_code || "COURSE"}
                      </div>
                      <div className="name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.title}
                      </div>
                    </div>
                    <span className="when">{dueDate}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add course */}
        <div className="bento fade-up d4" style={{ flex: 1 }}>
          <h4 style={{ marginBottom: 16 }}>Add Course</h4>
          <AddCourse onComplete={refresh} semesterId={activeSemesterId} />
        </div>
      </div>
    </div>
  );
}
