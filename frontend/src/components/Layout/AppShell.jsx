import React, { useRef, useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar, MobileTabbar } from "./Sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { useSemester } from "@/contexts/SemesterContext";

const SEMESTER_NAMES = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];

function SemesterChip() {
  const { semesters, activeSemesterId, setActiveSemester, createSemester } = useSemester();
  const [isOpen, setIsOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("S1");
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef(null);

  const activeSemester = semesters.find(s => s._id === activeSemesterId) || null;

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowNew(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const semester = await createSemester(newName, newLabel.trim());
      setActiveSemester(semester._id);
      setNewLabel("");
      setNewName("S1");
      setShowNew(false);
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to create semester", e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        className="sem-chip"
        onClick={() => { setIsOpen(o => !o); setShowNew(false); }}
      >
        <span className="pill">
          {activeSemester ? activeSemester.name : "ALL"}
        </span>
        {activeSemester ? (activeSemester.label || activeSemester.name) : "All Semesters"}
        <span className="caret" />
      </button>

      {isOpen && (
        <div className="glass" style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 280,
          padding: 10,
          zIndex: 80,
        }}>
          <div className="section-title" style={{ marginBottom: 8, paddingTop: 4 }}>
            Switch Semester
          </div>

          <div
            onClick={() => { setActiveSemester(null); setIsOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10, cursor: "pointer",
              background: !activeSemesterId ? "rgba(34,211,238,0.08)" : "transparent",
              border: "1px solid " + (!activeSemesterId ? "rgba(34,211,238,0.4)" : "transparent"),
              transition: "background 180ms",
            }}
          >
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              padding: "3px 7px", borderRadius: 999,
              background: "rgba(20,40,90,0.06)", color: "var(--gos-muted)",
            }}>ALL</span>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--gos-text)" }}>
              All Semesters
            </div>
          </div>

          {semesters.map(s => (
            <div
              key={s._id}
              onClick={() => { setActiveSemester(s._id); setIsOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                background: activeSemesterId === s._id ? "rgba(34,211,238,0.08)" : "transparent",
                border: "1px solid " + (activeSemesterId === s._id ? "rgba(34,211,238,0.4)" : "transparent"),
                transition: "background 180ms",
              }}
            >
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 7px",
                borderRadius: 999, background: "linear-gradient(180deg, #1ec7e6, #0ea5c4)",
                color: "#fff", fontWeight: 600,
              }}>{s.name}</span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--gos-text)" }}>
                  {s.label || s.name}
                </div>
                {s.term && (
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10,
                    letterSpacing: "0.16em", color: "var(--gos-muted)", textTransform: "uppercase",
                  }}>{s.term}</div>
                )}
              </div>
            </div>
          ))}

          <div style={{ height: 1, background: "var(--gos-border)", margin: "4px 8px" }} />

          {!showNew ? (
            <div
              onClick={() => setShowNew(true)}
              style={{
                padding: "10px 12px", fontFamily: "var(--font-mono)",
                fontSize: 11, letterSpacing: "0.16em", color: "var(--gos-cyan)", cursor: "pointer",
              }}
            >
              + New semester
            </div>
          ) : (
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              <select
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{
                  background: "var(--gos-bg-2)", border: "1px solid var(--gos-border)",
                  borderRadius: 6, padding: "4px 8px", fontSize: 11,
                  fontFamily: "var(--font-mono)", color: "var(--gos-text)",
                }}
              >
                {SEMESTER_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input
                type="text"
                placeholder="Label (e.g. Fall 2024)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
                style={{
                  background: "var(--gos-bg-2)", border: "1px solid var(--gos-border)",
                  borderRadius: 6, padding: "4px 8px", fontSize: 11,
                  fontFamily: "var(--font-mono)", color: "var(--gos-text)", outline: "none",
                }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newLabel.trim()}
                style={{
                  background: "rgba(34,211,238,0.18)", border: "1px solid rgba(34,211,238,0.35)",
                  borderRadius: 6, padding: "4px 10px", fontSize: 11,
                  fontFamily: "var(--font-mono)", color: "var(--gos-cyan)", cursor: "pointer",
                  opacity: (creating || !newLabel.trim()) ? 0.5 : 1,
                }}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getPageLabel(pathname) {
  if (pathname === "/") return "Dashboard";
  const seg = pathname.slice(1);
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export default function AppShell() {
  const loc = useLocation();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  }).toUpperCase();

  return (
    <div className="stage">
      <div className="dash-shell">
        <Sidebar />

        <header className="dash-top">
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.32em",
            color: "var(--gos-dim)",
            textTransform: "uppercase",
          }}>
            {getPageLabel(loc.pathname)} /
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "0.22em",
              color: "var(--gos-muted)",
              textTransform: "uppercase",
            }}>
              {dateStr}
            </div>
            <SemesterChip />
          </div>
        </header>

        <main style={{ overflow: "hidden auto", position: "relative" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={loc.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: "100%" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile only */}
      <div className="lg:hidden">
        <MobileTabbar />
      </div>
    </div>
  );
}
