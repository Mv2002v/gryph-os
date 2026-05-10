import React, { useCallback, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const HEAD = "'Space Grotesk', ui-sans-serif, system-ui";

// ── tiny inline spinner ────────────────────────────────────────────────────
function Spin() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
      style={{ animation: "spin 0.7s linear infinite", display: "inline-block", verticalAlign: "middle" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="6.5" cy="6.5" r="5" stroke="rgba(10,19,48,0.25)" strokeWidth="2"/>
      <path d="M6.5 1.5A5 5 0 0 1 11.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// ── status badge ──────────────────────────────────────────────────────────
function Badge({ status, events }) {
  const map = {
    queued:    { color: "var(--gos-muted)",    text: "Queued" },
    uploading: { color: "var(--gos-cyan)",     text: "Reading…" },
    done:      { color: "var(--gos-emerald)",  text: `✓ ${events} deadlines found` },
    error:     { color: "#f87171",             text: "✗ Failed" },
  };
  const s = map[status] || map.queued;
  return (
    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em",
      color: s.color, textTransform: "uppercase" }}>
      {status === "uploading" && <Spin />} {s.text}
    </span>
  );
}

// ── main component ────────────────────────────────────────────────────────
export default function AddCourse({ onComplete, semesterId }) {
  const [code, setCode]   = useState("");
  const [title, setTitle] = useState("");
  const [step, setStep]   = useState(1);   // 1 = name entry, 2 = file upload
  const [drag, setDrag]   = useState(false);
  const [uploads, setUploads] = useState([]);
  const inputRef = useRef(null);

  const handleNext = (e) => {
    e.preventDefault();
    if (!code.trim()) { toast.error("Course code is required"); return; }
    setStep(2);
  };

  const handleBack = () => { setStep(1); setUploads([]); };

  const processFiles = useCallback(async (picked) => {
    const pdfs = picked.filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) { toast.error("Please select PDF files only"); return; }

    const items = pdfs.map(f => ({
      id: `${f.name}-${Date.now()}`,
      file: f,
      name: f.name,
      status: "queued",
      events: 0,
    }));
    setUploads(prev => [...prev, ...items]);

    let totalEvents = 0;

    for (const it of items) {
      try {
        setUploads(prev => prev.map(u => u.id === it.id ? { ...u, status: "uploading" } : u));

        const fd = new FormData();
        fd.append("file", it.file, it.file.name);
        fd.append("course_code", code.trim().toUpperCase());
        if (title.trim()) fd.append("course_title", title.trim());
        if (semesterId) fd.append("semester_id", semesterId);

        const { data } = await api.post("/syllabi/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const ev = data.counts?.events ?? data.events?.length ?? 0;
        totalEvents += ev;
        setUploads(prev => prev.map(u => u.id === it.id ? { ...u, status: "done", events: ev } : u));
      } catch (err) {
        setUploads(prev => prev.map(u => u.id === it.id ? { ...u, status: "error" } : u));
        toast.error("Upload failed: " + (err?.response?.data?.detail || err.message));
      }
    }

    if (totalEvents > 0) {
      toast.success(`Found ${totalEvents} deadlines for ${code.trim().toUpperCase()}`);
      onComplete?.();
    }
  }, [code, title, semesterId, onComplete]);

  const onDrop = useCallback(e => {
    e.preventDefault();
    setDrag(false);
    processFiles(Array.from(e.dataTransfer?.files || []));
  }, [processFiles]);

  const onSelect = e => {
    processFiles(Array.from(e.target.files || []));
    if (e.target) e.target.value = "";
  };

  const handleSkip = async () => {
    // Create the course with no file — just the name
    try {
      await api.post("/courses", {
        code: code.trim().toUpperCase(),
        title: title.trim() || undefined,
      });
      toast.success(`Course ${code.trim().toUpperCase()} added`);
      onComplete?.();
      setCode(""); setTitle(""); setStep(1); setUploads([]);
    } catch (err) {
      toast.error("Could not create course");
    }
  };

  const handleDone = () => {
    setCode(""); setTitle(""); setStep(1); setUploads([]);
    onComplete?.();
  };

  const allDone = uploads.length > 0 && uploads.every(u => u.status === "done" || u.status === "error");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Step 1: Course name ── */}
      {step === 1 && (
        <form onSubmit={handleNext} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "0 0 120px" }}>
              <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em",
                textTransform: "uppercase", color: "var(--gos-muted)", display: "block", marginBottom: 6 }}>
                Code *
              </label>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="CIS 2120"
                autoFocus
                style={{
                  width: "100%", background: "rgba(20,40,90,0.04)",
                  border: "1px solid rgba(20,40,90,0.12)", borderRadius: 8,
                  padding: "8px 12px", fontFamily: MONO, fontSize: 12,
                  color: "var(--gos-text)", outline: "none", letterSpacing: "0.08em",
                  transition: "border-color 200ms",
                }}
                onFocus={e => e.target.style.borderColor = "var(--gos-cyan)"}
                onBlur={e => e.target.style.borderColor = "rgba(20,40,90,0.12)"}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em",
                textTransform: "uppercase", color: "var(--gos-muted)", display: "block", marginBottom: 6 }}>
                Title (optional)
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Introduction to Computing Systems"
                style={{
                  width: "100%", background: "rgba(20,40,90,0.04)",
                  border: "1px solid rgba(20,40,90,0.12)", borderRadius: 8,
                  padding: "8px 12px", fontFamily: HEAD, fontSize: 13,
                  color: "var(--gos-text)", outline: "none",
                  transition: "border-color 200ms",
                }}
                onFocus={e => e.target.style.borderColor = "var(--gos-cyan)"}
                onBlur={e => e.target.style.borderColor = "rgba(20,40,90,0.12)"}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary"
            style={{ alignSelf: "flex-start", padding: "9px 22px" }}>
            Next — Upload Outline →
          </button>
        </form>
      )}

      {/* ── Step 2: File upload ── */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Course header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={handleBack}
              style={{ background: "none", border: "none", cursor: "pointer",
                fontFamily: MONO, fontSize: 10, color: "var(--gos-muted)",
                letterSpacing: "0.14em", textTransform: "uppercase", padding: 0 }}>
              ← Back
            </button>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.18em",
              color: "var(--gos-cyan)", textTransform: "uppercase", fontWeight: 600 }}>
              {code.trim().toUpperCase()}
            </div>
            {title && (
              <div style={{ fontFamily: HEAD, fontSize: 13, color: "var(--gos-muted)" }}>
                · {title}
              </div>
            )}
          </div>

          {/* Drop zone */}
          <div
            className={"upload-zone" + (drag ? " drag" : "")}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3v5h5"/><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2z"/>
                <path d="M12 11v6"/><path d="M9 14l3-3 3 3"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 14, margin: 0 }}>
              {drag ? "Release to upload…" : "Drop the course outline PDF here"}
            </h3>
            <p className="hint">PDF only · up to 12 MB</p>
            <button className="btn btn-primary"
              onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
              style={{ margin: "14px auto 0", display: "inline-flex" }}>
              Choose file
            </button>
            <input ref={inputRef} type="file" accept="application/pdf" multiple
              style={{ display: "none" }} onChange={onSelect} />
          </div>

          {/* Upload list */}
          {uploads.length > 0 && (
            <div className="uploaded-list">
              {uploads.map(u => (
                <div key={u.id} className="upd-card">
                  <div className="pdf-icon" />
                  <div className="name">{u.name.replace(/\.pdf$/i, "")}</div>
                  <div className="meta"><Badge status={u.status} events={u.events} /></div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            {allDone ? (
              <button onClick={handleDone} className="btn btn-primary">
                ✓ Done — view in dashboard
              </button>
            ) : (
              <button onClick={handleSkip} className="btn btn-ghost"
                style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em" }}>
                Skip — add course without file
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
