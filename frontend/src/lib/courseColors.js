// Course color palette — used consistently across calendar, chips, dots
export const COURSE_PALETTE = [
  { key: "sky",    bg: "#E0F2FE", text: "#075985", dot: "#0EA5E9", border: "#BAE6FD" },
  { key: "lime",   bg: "#DCFCE7", text: "#14532D", dot: "#22C55E", border: "#BBF7D0" },
  { key: "sun",    bg: "#FEF9C3", text: "#713F12", dot: "#F59E0B", border: "#FDE68A" },
  { key: "pink",   bg: "#FCE7F3", text: "#831843", dot: "#EC4899", border: "#FBCFE8" },
  { key: "teal",   bg: "#CCFBF1", text: "#134E4A", dot: "#14B8A6", border: "#99F6E4" },
  { key: "violet", bg: "#EDE9FE", text: "#4C1D95", dot: "#8B5CF6", border: "#DDD6FE" },
  { key: "orange", bg: "#FFEDD5", text: "#7C2D12", dot: "#F97316", border: "#FED7AA" },
];

export function colorForCourse(course) {
  if (!course) return COURSE_PALETTE[0];
  const i = (course.color_index ?? 0) % COURSE_PALETTE.length;
  return COURSE_PALETTE[i];
}

export function classnames(...arr) {
  return arr.filter(Boolean).join(" ");
}

export function fmtDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function daysUntil(iso) {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  return diff;
}

export function urgencyColor(days) {
  if (days == null) return null;
  if (days < 0) return { color: "#94A3B8", label: "Past" };
  if (days === 0) return { color: "#EF4444", label: "Today" };
  if (days <= 2) return { color: "#EF4444", label: `${days}d` };
  if (days <= 7) return { color: "#F59E0B", label: `${days}d` };
  return { color: "#0EA5E9", label: `${days}d` };
}

export function eventTypeLabel(t) {
  return ({
    assignment: "Assignment",
    quiz: "Quiz",
    midterm: "Midterm",
    final: "Final",
    project: "Project",
    reading: "Reading",
    other: "Other",
  })[t] || "Other";
}
