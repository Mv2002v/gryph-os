import React, { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Sparkles, UploadCloud, FileText, Phone } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function QuizStudioPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [course, setCourse] = useState("");
  const [num, setNum] = useState(5);
  const [diff, setDiff] = useState("medium");
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const refresh = async () => {
    const r = await api.get("/quizzes");
    setQuizzes(r.data);
    if (r.data?.length && !active) setActive(r.data[0]);
  };
  useEffect(() => {
    refresh();
  }, []);

  const generate = async () => {
    if (!file && !text.trim()) {
      toast.error("Upload a file or paste study text");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file, file.name);
      if (text.trim()) fd.append("text", text.trim());
      if (topic) fd.append("topic", topic);
      if (course) fd.append("course", course);
      if (topic) fd.append("title", topic);
      fd.append("num_questions", String(num));
      fd.append("difficulty", diff);
      const { data } = await api.post("/quiz/generate", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`Generated ${data.questions?.length || 0} questions`);
      setActive(data);
      setFile(null);
      setText("");
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not generate quiz");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    await api.delete(`/quizzes/${id}`);
    toast.success("Quiz deleted");
    if (active?.id === id) setActive(null);
    refresh();
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      <header>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Quiz Studio
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
          Turn study material into quizzes
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Generator */}
        <Card className="lg:col-span-5 rounded-card border border-border bg-card shadow-soft p-5 space-y-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            New quiz
          </div>
          <h2 className="font-heading text-xl tracking-tight">Upload material</h2>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-card border-2 border-dashed border-border bg-secondary/40 hover:bg-secondary/60 ui-fade p-6 text-center"
            data-testid="study-material-upload"
          >
            <UploadCloud className="mx-auto h-8 w-8 text-primary" />
            <div className="mt-2 text-sm font-medium">
              {file ? file.name : "Click to upload PDF/text"}
            </div>
            <div className="text-xs text-muted-foreground">PDF, TXT, MD up to 15MB</div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </button>

          <div className="text-xs text-muted-foreground text-center">or paste text</div>
          <Textarea
            placeholder="Paste notes, an excerpt, or topic outline…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            data-testid="study-material-text"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Topic / title</Label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Integration by Parts"
                data-testid="quiz-topic-input"
              />
            </div>
            <div>
              <Label className="text-xs">Course (optional)</Label>
              <Input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="MATH 201"
                data-testid="quiz-course-input"
              />
            </div>
            <div>
              <Label className="text-xs">Questions</Label>
              <Select value={String(num)} onValueChange={(v) => setNum(Number(v))}>
                <SelectTrigger data-testid="quiz-num-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 5, 8, 10, 12, 15].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Difficulty</Label>
              <Select value={diff} onValueChange={setDiff}>
                <SelectTrigger data-testid="quiz-difficulty-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={generate}
            disabled={busy}
            className="w-full h-11 shadow-pop ui-press"
            data-testid="quiz-generate-button"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {busy ? "Generating with Gemini…" : "Generate quiz"}
          </Button>
        </Card>

        {/* Library + preview */}
        <div className="lg:col-span-7 space-y-4">
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview" data-testid="quiz-tab-preview">Preview</TabsTrigger>
              <TabsTrigger value="library" data-testid="quiz-tab-library">My quizzes ({quizzes.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-4">
              {busy && <QuizSkeleton />}
              {!busy && active && <QuizPreview quiz={active} onCall={() => navigate(`/calls?quiz=${active.id}`)} />}
              {!busy && !active && (
                <Card className="rounded-card border border-border bg-card shadow-soft p-10 text-center text-muted-foreground">
                  Generate a quiz to see it here.
                </Card>
              )}
            </TabsContent>
            <TabsContent value="library" className="mt-4">
              {quizzes.length === 0 ? (
                <Card className="rounded-card border border-border bg-card shadow-soft p-10 text-center text-muted-foreground">
                  No quizzes yet.
                </Card>
              ) : (
                <ul className="space-y-2">
                  {quizzes.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center gap-3 rounded-control border border-border bg-card px-3 py-2 hover:shadow-pop ui-fade"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => setActive(q)}
                        data-testid="quiz-library-row"
                      >
                        <div className="text-sm font-medium truncate">{q.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {q.questions?.length || 0} questions · {q.difficulty}
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/calls?quiz=${q.id}`)}
                        title="Call me about this quiz"
                        data-testid="quiz-library-call"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(q.id)}
                        data-testid="quiz-library-delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function QuizSkeleton() {
  return (
    <Card className="rounded-card border border-border bg-card shadow-soft p-5 space-y-3">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </Card>
  );
}

function QuizPreview({ quiz, onCall }) {
  return (
    <Card className="rounded-card border border-border bg-card shadow-soft p-5" data-testid="quiz-preview">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Quiz preview
          </div>
          <h3 className="font-heading text-xl tracking-tight">{quiz.title}</h3>
          <div className="text-xs text-muted-foreground mt-1">
            {quiz.questions?.length || 0} questions · {quiz.difficulty}
            {quiz.course ? ` · ${quiz.course}` : ""}
          </div>
        </div>
        <Button onClick={onCall} className="shadow-pop ui-press" data-testid="quiz-call-me">
          <Phone className="h-4 w-4 mr-2" /> Call me
        </Button>
      </div>
      <div className="mt-4 space-y-3">
        {(quiz.questions || []).map((q, i) => (
          <div
            key={i}
            className="rounded-control border border-border bg-card p-3"
            data-testid="quiz-question"
          >
            <div className="text-sm font-medium">
              {i + 1}. {q.q}
            </div>
            <ul className="mt-2 grid sm:grid-cols-2 gap-1.5">
              {(q.choices || []).map((c, j) => {
                const correct = j === q.answerIndex;
                return (
                  <li
                    key={j}
                    className="flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs"
                    style={
                      correct
                        ? { background: "#DCFCE7", color: "#14532D", borderColor: "#BBF7D0" }
                        : {}
                    }
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {String.fromCharCode(65 + j)}
                    </span>
                    <span className="truncate">{c}</span>
                    {correct && (
                      <span className="ml-auto text-[10px] font-semibold">✓ correct</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {q.explanation && (
              <div className="mt-2 text-xs text-muted-foreground">{q.explanation}</div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
