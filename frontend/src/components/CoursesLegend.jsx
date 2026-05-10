import React from "react";
import { Card } from "@/components/ui/card";
import { COURSE_PALETTE } from "@/lib/courseColors";

export default function CoursesLegend({ courses }) {
  if (!courses?.length) return null;
  return (
    <Card
      className="rounded-card border border-border bg-card shadow-soft p-4"
      data-testid="courses-legend"
    >
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        Your courses
      </div>
      <div className="flex flex-wrap gap-2">
        {courses.map((c) => {
          const p = COURSE_PALETTE[(c.color_index ?? 0) % COURSE_PALETTE.length];
          return (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
              style={{ background: p.bg, color: p.text, borderColor: p.border }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: p.dot }} />
              {c.code}
              {c.title ? <span className="opacity-70">· {c.title}</span> : null}
            </span>
          );
        })}
      </div>
    </Card>
  );
}
