import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Trash2, Download, FileText, BookOpen, AlertTriangle, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import api from "@/lib/api";

export default function SettingsPage() {
  const { user, updateMe } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [busy, setBusy] = useState(false);

  const [summary, setSummary] = useState(null);
  const [courses, setCourses] = useState([]);
  const [syllabi, setSyllabi] = useState([]);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, c, sy] = await Promise.all([
        api.get("/account/summary"),
        api.get("/courses"),
        api.get("/syllabi"),
      ]);
      setSummary(s.data);
      setCourses(c.data);
      setSyllabi(sy.data);
    } catch (err) {
      console.error("Settings refresh failed", err);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async () => {
    setBusy(true);
    try {
      await updateMe({ name, phone });
      toast.success("Saved");
    } catch (e) {
      toast.error("Could not save");
    } finally {
      setBusy(false);
    }
  };

  const del = async (path, label) => {
    try {
      await api.delete(path);
      toast.success(`${label} deleted`);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not delete");
    }
  };

  const downloadSyllabus = async (id, filename) => {
    try {
      const { data } = await api.get(`/syllabi/${id}/download`);
      window.open(data.url, "_blank");
    } catch {
      toast.error("Could not get download link");
    }
  };

  const resetAll = async () => {
    setResetting(true);
    try {
      const { data } = await api.post("/account/reset");
      const total = Object.values(data.deleted || {}).reduce((a, b) => a + b, 0);
      toast.success(`Reset complete — removed ${total} items`);
      refresh();
    } catch (e) {
      toast.error("Reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Settings</div>
        <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">Profile &amp; data</h1>
        <p className="text-muted-foreground mt-1">
          Edit your profile or manage everything you've uploaded and generated.
        </p>
      </header>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" data-testid="settings-tab-profile">Profile</TabsTrigger>
          <TabsTrigger value="data" data-testid="settings-tab-data">My data</TabsTrigger>
          <TabsTrigger value="danger" data-testid="settings-tab-danger">Danger zone</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="mt-4">
          <Card className="rounded-card border border-border bg-card shadow-soft p-5 space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="h-11" />
              <div className="text-[11px] text-muted-foreground mt-1">
                Managed by AWS Cognito · cannot be changed here.
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={name} onChange={(e) => setName(e.target.value)}
                className="h-11" data-testid="settings-name-input"
              />
            </div>
            <div>
              <Label>Phone (E.164)</Label>
              <Input
                value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+14155552671" className="h-11"
                data-testid="settings-phone-input"
              />
            </div>
            <Button onClick={save} disabled={busy} className="shadow-pop ui-press" data-testid="settings-save-button">
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </Card>
        </TabsContent>

        {/* My data */}
        <TabsContent value="data" className="mt-4 space-y-4">
          {/* Summary counts */}
          <Card className="rounded-card border border-border bg-card shadow-soft p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Your semester data
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Courses"   value={summary?.courses ?? 0} />
              <Stat label="Deadlines" value={summary?.events ?? 0} />
              <Stat label="Files"     value={summary?.syllabi ?? 0} />
            </div>
          </Card>

          {/* Courses — grouped with their syllabi */}
          <Card className="rounded-card border border-border bg-card shadow-soft p-4" data-testid="settings-courses-list">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div className="font-heading text-sm tracking-tight">Courses</div>
              <span className="text-xs text-muted-foreground">({courses.length})</span>
            </div>

            {courses.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No courses yet — add one from the Dashboard.
              </div>
            ) : (
              <ul className="space-y-3">
                {courses.map((c) => {
                  const courseSyllabi = syllabi.filter(s => s.course_id === c.id);
                  return (
                    <li key={c.id} style={{
                      borderRadius: 10,
                      border: "1px solid rgba(20,40,90,0.08)",
                      padding: "12px 14px",
                      background: "rgba(20,40,90,0.02)",
                    }}>
                      {/* Course header row */}
                      <div className="flex items-start gap-3">
                        <div style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10, letterSpacing: "0.18em",
                          background: "rgba(34,211,238,0.12)",
                          color: "var(--gos-cyan, #22d3ee)",
                          padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap",
                          alignSelf: "flex-start", marginTop: 1,
                        }}>
                          {c.code}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {c.title || <span className="text-muted-foreground italic">No title</span>}
                          </div>
                          {(c.term || c.instructor) && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {[c.term, c.instructor].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                        <DeleteBtn
                          testid={`delete-course-${c.id}`}
                          label="Delete course"
                          description="Removes this course, all its deadlines, and uploaded files from S3."
                          onConfirm={() => del(`/courses/${c.id}`, "Course")}
                        />
                      </div>

                      {/* Syllabi attached to this course */}
                      {courseSyllabi.length > 0 && (
                        <div style={{ marginTop: 10, paddingLeft: 8, borderLeft: "2px solid rgba(34,211,238,0.2)", display: "flex", flexDirection: "column", gap: 6 }}>
                          {courseSyllabi.map(s => (
                            <div key={s.id} className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs truncate flex-1">{s.filename}</span>
                              <span className="text-xs text-muted-foreground shrink-0">{(s.size/1024).toFixed(0)} KB</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => downloadSyllabus(s.id, s.filename)}
                                title="Download">
                                <Download className="h-3 w-3" />
                              </Button>
                              <DeleteBtn
                                testid={`delete-syllabus-${s.id}`}
                                label="Delete file"
                                description="Removes this PDF from S3. Deadlines extracted from it stay."
                                onConfirm={() => del(`/syllabi/${s.id}`, "File")}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {courseSyllabi.length === 0 && (
                        <div style={{ marginTop: 8, paddingLeft: 8, fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10, letterSpacing: "0.14em", color: "rgba(20,40,90,0.3)",
                          textTransform: "uppercase" }}>
                          No outline uploaded
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </TabsContent>

        {/* Danger zone */}
        <TabsContent value="danger" className="mt-4">
          <Card className="rounded-card border-2 border-rose-200 bg-rose-50 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 grid place-items-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-heading text-lg text-rose-900">
                  Reset everything &amp; start from scratch
                </div>
                <p className="text-sm text-rose-800/80">
                  Deletes <strong>all</strong> your courses, deadlines, syllabi (incl. S3 files),
                  generated quizzes, scheduled calls, and call history. Your account stays.
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="rounded-control"
                  data-testid="settings-reset-button"
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> Reset all my data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset everything?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes all your courses, deadlines, syllabi (including
                    files in AWS S3), quizzes, scheduled calls, and call history. This cannot
                    be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="settings-reset-cancel">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={resetAll}
                    disabled={resetting}
                    className="bg-rose-600 hover:bg-rose-700"
                    data-testid="settings-reset-confirm"
                  >
                    {resetting ? "Resetting…" : "Yes, wipe everything"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-control border border-border bg-secondary/40 p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-heading text-xl font-semibold">{value}</div>
    </div>
  );
}

function DataList({ title, icon: Icon, items, empty, renderRow, testid }) {
  return (
    <Card className="rounded-card border border-border bg-card shadow-soft p-4" data-testid={testid}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="font-heading text-sm tracking-tight">{title}</div>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">{empty}</div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="py-2.5 flex items-center gap-3">
              {renderRow(it)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DeleteBtn({ label, description, onConfirm, testid }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost" size="icon"
          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          title={label}
          data-testid={testid}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-rose-600 hover:bg-rose-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
