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
  Trash2, Download, FileText, BookOpen, Sparkles, Phone, AlertTriangle,
  RefreshCw, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import api from "@/lib/api";
import { fmtDate } from "@/lib/courseColors";

export default function SettingsPage() {
  const { user, updateMe } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [busy, setBusy] = useState(false);

  const [summary, setSummary] = useState(null);
  const [courses, setCourses] = useState([]);
  const [syllabi, setSyllabi] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [calls, setCalls] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, c, sy, q, cl, sc] = await Promise.all([
        api.get("/account/summary"),
        api.get("/courses"),
        api.get("/syllabi"),
        api.get("/quizzes"),
        api.get("/calls"),
        api.get("/schedule"),
      ]);
      setSummary(s.data);
      setCourses(c.data);
      setSyllabi(sy.data);
      setQuizzes(q.data);
      setCalls(cl.data);
      setScheduled(sc.data);
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
          <Card className="rounded-card border border-border bg-card shadow-soft p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              Stored across AWS S3 + MongoDB
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
              <Stat label="Courses"    value={summary?.courses ?? 0} />
              <Stat label="Events"     value={summary?.events ?? 0} />
              <Stat label="Syllabi"    value={summary?.syllabi ?? 0} />
              <Stat label="Quizzes"    value={summary?.quizzes ?? 0} />
              <Stat label="Calls"      value={summary?.calls ?? 0} />
              <Stat label="Scheduled"  value={summary?.scheduled ?? 0} />
            </div>
          </Card>

          <DataList
            title="Courses" icon={BookOpen} testid="settings-courses-list"
            items={courses}
            empty="No courses yet."
            renderRow={(c) => (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.code} {c.title ? `· ${c.title}` : ""}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.term || ""} {c.instructor ? `· ${c.instructor}` : ""}
                  </div>
                </div>
                <DeleteBtn
                  testid={`delete-course-${c.id}`}
                  label="Delete course"
                  description="This removes the course AND all its events + uploaded syllabi (S3 too)."
                  onConfirm={() => del(`/courses/${c.id}`, "Course")}
                />
              </>
            )}
          />

          <DataList
            title="Syllabi (S3)" icon={FileText} testid="settings-syllabi-list"
            items={syllabi}
            empty="No syllabi uploaded yet."
            renderRow={(s) => (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.filename}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {(s.size/1024).toFixed(1)} KB · s3://{s.s3_bucket}/{s.s3_key}
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => downloadSyllabus(s.id, s.filename)}
                  title="Download (presigned)"
                  data-testid={`download-syllabus-${s.id}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <DeleteBtn
                  testid={`delete-syllabus-${s.id}`}
                  label="Delete syllabus"
                  description="Removes this PDF from S3 and from your records (events stay)."
                  onConfirm={() => del(`/syllabi/${s.id}`, "Syllabus")}
                />
              </>
            )}
          />

          <DataList
            title="Quizzes" icon={Sparkles} testid="settings-quizzes-list"
            items={quizzes}
            empty="No quizzes generated yet."
            renderRow={(q) => (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{q.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {q.questions?.length || 0} questions · {q.difficulty}
                  </div>
                </div>
                <DeleteBtn
                  testid={`delete-quiz-${q.id}`}
                  label="Delete quiz"
                  description="Also deletes its source file from S3 if any."
                  onConfirm={() => del(`/quizzes/${q.id}`, "Quiz")}
                />
              </>
            )}
          />

          <DataList
            title="Call history" icon={Phone} testid="settings-calls-list"
            items={calls}
            empty="No calls yet."
            renderRow={(c) => (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {c.quiz_title} {c.percent != null ? <span className="text-emerald-600">· {c.percent}%</span> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.phone} · {c.status} · {fmtDate(new Date(c.created_at * 1000).toISOString().slice(0,10))}
                  </div>
                </div>
                <DeleteBtn
                  testid={`delete-call-${c.id}`}
                  label="Delete call"
                  description="Removes this call session and its transcript."
                  onConfirm={() => del(`/calls/${c.id}`, "Call")}
                />
              </>
            )}
          />

          <DataList
            title="Scheduled calls" icon={Clock} testid="settings-scheduled-list"
            items={scheduled.filter((s) => s.status === "scheduled")}
            empty="No upcoming scheduled calls."
            renderRow={(s) => (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.quiz_title}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.phone} · {new Date(s.when_ts * 1000).toLocaleString()}
                  </div>
                </div>
                <DeleteBtn
                  testid={`cancel-schedule-${s.id}`}
                  label="Cancel schedule"
                  description="The scheduler won't fire this call."
                  onConfirm={() => del(`/schedule/${s.id}`, "Scheduled call")}
                />
              </>
            )}
          />
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
