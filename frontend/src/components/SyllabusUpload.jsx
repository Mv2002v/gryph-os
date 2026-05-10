import React, { useCallback, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function SyllabusUpload({ onComplete }) {
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);

  const handleFiles = useCallback(
    async (picked) => {
      const pdfs = picked.filter(f => f.name.toLowerCase().endsWith(".pdf"));
      if (!pdfs.length) {
        toast.error("Please drop PDF files");
        return;
      }
      const items = pdfs.map(f => ({
        id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        name: f.name,
        status: "queued",
        progress: 0,
        events: 0,
      }));
      setFiles(prev => [...prev, ...items]);

      let totalEvents = 0;
      const totalCourses = new Set();

      for (const it of items) {
        try {
          setFiles(prev => prev.map(p => p.id === it.id ? { ...p, status: "uploading", progress: 12 } : p));
          const fd = new FormData();
          fd.append("file", it.file, it.file.name);
          const pulse = setInterval(() => {
            setFiles(prev => prev.map(p =>
              p.id === it.id && p.progress < 90 ? { ...p, progress: p.progress + 5 } : p
            ));
          }, 700);
          const { data } = await api.post("/syllabi/upload", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          clearInterval(pulse);
          const ev = data.counts?.events ?? data.events?.length ?? 0;
          totalEvents += ev;
          if (data.course?.code) totalCourses.add(data.course.code);
          setFiles(prev => prev.map(p => p.id === it.id
            ? { ...p, status: "done", progress: 100, events: ev, course: data.course?.code }
            : p
          ));
        } catch (err) {
          console.error("Syllabus upload failed", err);
          setFiles(prev => prev.map(p => p.id === it.id ? { ...p, status: "error", progress: 100 } : p));
          toast.error("Failed to extract: " + (err?.response?.data?.detail || err.message || "unknown"));
        }
      }

      if (totalEvents > 0) {
        toast.success(`Found ${totalEvents} deadlines across ${totalCourses.size} courses`);
        onComplete?.({ events: totalEvents, courses: totalCourses.size });
      }
    },
    [onComplete]
  );

  const onSelect = e => {
    void handleFiles(Array.from(e.target.files || []));
    if (e.target) e.target.value = "";
  };

  const onDrop = useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(false);
    void handleFiles(Array.from(e.dataTransfer?.files || []));
  }, [handleFiles]);

  return (
    <div>
      <div
        className={"upload-zone" + (drag ? " drag" : "")}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        data-testid="syllabus-upload-dropzone"
      >
        <div className="icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h3>{drag ? "Drop to upload…" : "Drop your syllabi here"}</h3>
        <p className="hint">PDF files only · up to 12 MB each</p>
        <button
          className="btn btn-primary"
          onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
          style={{ margin: "18px auto 0", display: "inline-flex" }}
          data-testid="syllabus-upload-button"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          style={{ display: "none" }}
          onChange={onSelect}
          data-testid="syllabus-upload-input"
        />
      </div>

      {files.length > 0 && (
        <div className="uploaded-list">
          {files.map(f => (
            <div key={f.id} className="upd-card">
              <div className="pdf-icon" />
              <div className="name">{f.name.replace(/\.pdf$/i, "")}</div>
              <div className="meta">
                {f.status === "done" && `✓ ${f.events} deadlines`}
                {f.status === "error" && "✗ Failed"}
                {(f.status === "uploading") && `${f.progress}%`}
                {f.status === "queued" && "Queued"}
              </div>
              {(f.status === "uploading") && (
                <div style={{
                  height: 2, background: "var(--gos-border)", borderRadius: 1, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", width: f.progress + "%",
                    background: "var(--gos-cyan)", transition: "width 600ms ease",
                  }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
