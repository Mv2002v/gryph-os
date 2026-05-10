import React, { useCallback, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { classnames } from "@/lib/courseColors";

export default function SyllabusUpload({ onComplete }) {
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);

  const handleFiles = useCallback(
    async (picked) => {
      const pdfs = picked.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
      if (!pdfs.length) {
        toast.error("Please drop PDF files");
        return;
      }
      const items = pdfs.map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        name: f.name,
        size: f.size,
        status: "queued",
        progress: 0,
        events: 0,
      }));
      setFiles((prev) => [...prev, ...items]);
      let totalEvents = 0;
      const totalCourses = new Set();
      for (const it of items) {
        try {
          setFiles((prev) =>
            prev.map((p) => (p.id === it.id ? { ...p, status: "uploading", progress: 12 } : p))
          );
          const fd = new FormData();
          fd.append("file", it.file, it.file.name);
          const pulse = setInterval(() => {
            setFiles((prev) =>
              prev.map((p) =>
                p.id === it.id && p.progress < 92 ? { ...p, progress: p.progress + 4 } : p
              )
            );
          }, 700);
          const { data } = await api.post("/syllabi/upload", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          clearInterval(pulse);
          const ev = data.counts?.events ?? data.events?.length ?? 0;
          totalEvents += ev;
          if (data.course?.code) totalCourses.add(data.course.code);
          setFiles((prev) =>
            prev.map((p) =>
              p.id === it.id
                ? { ...p, status: "done", progress: 100, events: ev, course: data.course?.code }
                : p
            )
          );
        } catch (err) {
          console.error("Syllabus upload failed", err);
          setFiles((prev) =>
            prev.map((p) => (p.id === it.id ? { ...p, status: "error", progress: 100 } : p))
          );
          toast.error(
            "Failed to extract: " + (err?.response?.data?.detail || err.message || "unknown")
          );
        }
      }
      if (totalEvents > 0) {
        toast.success(`Found ${totalEvents} deadlines across ${totalCourses.size} courses`);
        onComplete?.({ events: totalEvents, courses: totalCourses.size });
      }
    },
    [onComplete]
  );

  const onSelect = (e) => {
    const picked = Array.from(e.target.files || []);
    void handleFiles(picked);
    if (e.target) e.target.value = "";
  };

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDrag(false);
      const picked = Array.from(e.dataTransfer?.files || []);
      void handleFiles(picked);
    },
    [handleFiles]
  );

  return (
    <Card className="rounded-card border border-border bg-card shadow-soft p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Step 1
          </div>
          <h2 className="font-heading text-xl sm:text-2xl tracking-tight">
            Upload your syllabi
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Drop one or more PDFs — we’ll extract every deadline automatically.
          </p>
        </div>
        <Button
          onClick={() => inputRef.current?.click()}
          className="shadow-pop ui-press"
          data-testid="syllabus-upload-button"
        >
          <UploadCloud className="h-4 w-4 mr-2" /> Choose files
        </Button>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={classnames(
          "mt-4 rounded-card border-2 border-dashed bg-secondary/40 p-8 sm:p-12 text-center ui-fade cursor-pointer",
          drag ? "border-primary shadow-glow bg-secondary/70" : "border-border hover:bg-secondary/60"
        )}
        onClick={() => inputRef.current?.click()}
        data-testid="syllabus-upload-dropzone"
      >
        <UploadCloud className="mx-auto h-10 w-10 text-primary" />
        <div className="mt-3 font-medium">
          {drag ? "Drop them here…" : "Drag & drop syllabus PDFs"}
        </div>
        <div className="text-xs text-muted-foreground">PDF only • up to 12MB each</div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={onSelect}
          data-testid="syllabus-upload-input"
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-5 space-y-2" data-testid="syllabus-upload-progress">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-control border border-border bg-secondary/30 px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <Progress value={f.progress} className="h-1.5 mt-1" />
              </div>
              <div className="text-xs w-28 text-right">
                {f.status === "done" && (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {f.events} deadlines
                  </span>
                )}
                {f.status === "error" && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" /> Failed
                  </span>
                )}
                {(f.status === "uploading" || f.status === "queued") && (
                  <span className="text-muted-foreground">Reading…</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
