import { useState, useCallback, useRef, useEffect } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const SHARED_USER_ID = "00000000-0000-0000-0000-000000000001";

const HISTORY_KEY = "ok_check_completion_history";

function saveCompletionRate(percent: number) {
  const today = new Date().toISOString().slice(0, 10);
  const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
  stored[today] = Math.round(percent);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(stored));
}

function getLast7Days(): { date: string; percent: number }[] {
  const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    return { date: label, percent: stored[key] ?? null };
  });
}

const CompletionChart = ({ percent }: { percent: number }) => {
  const [data, setData] = useState(getLast7Days());

  useEffect(() => {
    saveCompletionRate(percent);
    setData(getLast7Days());
  }, [percent]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">최근 7일 완료율</p>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} barCategoryGap="30%">
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            formatter={(v: number) => [`${v}%`, "완료율"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
            cursor={{ fill: "hsl(var(--muted))" }}
          />
          <Bar dataKey="percent" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.percent === null ? "hsl(var(--muted))" : entry.percent >= 80 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

type CheckItem = {
  id: string;
  category: string;
  title: string;
  checked: boolean;
  memo: string;
  updated_at: string;
  user_id: string;
};

type FilterType = "전체" | "완료" | "미완료";
const CATEGORIES = ["월간 점검", "분기 점검"];

function useDebouncedCallback<T extends (...args: any[]) => void>(callback: T, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]) as T;
}


const ChecklistApp = () => {
  const [filter, setFilter] = useState<FilterType>("전체");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["checklist_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .order("category")
        .order("title");
      if (error) throw error;
      return data as CheckItem[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CheckItem> }) => {
      const { error } = await supabase.from("checklist_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["checklist_items"] });
      const previous = queryClient.getQueryData<CheckItem[]>(["checklist_items"]);
      queryClient.setQueryData<CheckItem[]>(["checklist_items"], (old) =>
        old?.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["checklist_items"], context.previous);
      toast.error("저장 실패");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["checklist_items"] }),
  });

  const addMutation = useMutation({
    mutationFn: async ({ title, category }: { title: string; category: string }) => {
      const { error } = await supabase.from("checklist_items").insert({ title, category, user_id: SHARED_USER_ID });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist_items"] });
      setNewTitle("");
      setShowAddForm(false);
      toast.success("항목이 추가되었습니다");
    },
    onError: () => toast.error("추가 실패"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["checklist_items"] });
      const previous = queryClient.getQueryData<CheckItem[]>(["checklist_items"]);
      queryClient.setQueryData<CheckItem[]>(["checklist_items"], (old) => old?.filter((item) => item.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["checklist_items"], context.previous);
      toast.error("삭제 실패");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["checklist_items"] }),
  });

  const toggleCheck = (id: string, currentChecked: boolean) => {
    updateMutation.mutate({ id, updates: { checked: !currentChecked } });
  };

  const debouncedUpdateMemo = useDebouncedCallback((id: string, memo: string) => {
    updateMutation.mutate({ id, updates: { memo } });
  }, 800);

  const handleMemoChange = (id: string, memo: string) => {
    queryClient.setQueryData<CheckItem[]>(["checklist_items"], (old) =>
      old?.map((item) => (item.id === id ? { ...item, memo } : item))
    );
    debouncedUpdateMemo(id, memo);
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addMutation.mutate({ title: newTitle.trim(), category: newCategory });
  };

  const completedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const filtered = items.filter((item) => {
    if (filter === "완료") return item.checked;
    if (filter === "미완료") return !item.checked;
    return true;
  });

  const categories = [...new Set(items.map((i) => i.category))];
  const filters: FilterType[] = ["전체", "완료", "미완료"];

  const isCategoryOpen = (cat: string) => openCategories[cat] !== false;
  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !isCategoryOpen(cat) }));
  };

  const getCategoryStats = (cat: string) => {
    const catItems = items.filter((i) => i.category === cat);
    const done = catItems.filter((i) => i.checked).length;
    return { done, total: catItems.length, percent: catItems.length > 0 ? (done / catItems.length) * 100 : 0 };
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-blue-900" style={{ backgroundColor: "#1e40af" }}>
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white tracking-tight">
              OK금융 업무 점검
            </h1>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-xs text-white/70">
                {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
              </span>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 transition-colors hover:bg-blue-50"
              >
                {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {showAddForm ? "취소" : "항목 추가"}
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Progress value={progressPercent} className="h-2 flex-1 bg-white/20 [&>div]:bg-white" />
            <span className="text-sm font-semibold text-white/80 whitespace-nowrap">
              {completedCount}/{totalCount} ({Math.round(progressPercent)}%)
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-white text-blue-900"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </header>

      {showAddForm && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="점검 항목명 입력..."
              className="bg-muted/50 border-border text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <div className="flex items-center gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1 rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm text-foreground"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={handleAdd}
                disabled={!newTitle.trim() || addMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6 pb-20">
        <CompletionChart percent={progressPercent} />
        {categories.map((cat) => {
          const catFiltered = filtered.filter((item) => item.category === cat);
          if (catFiltered.length === 0 && filter !== "전체") return null;
          const stats = getCategoryStats(cat);
          const open = isCategoryOpen(cat);

          return (
            <Collapsible key={cat} open={open} onOpenChange={() => toggleCategory(cat)}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center gap-3 mb-3 group cursor-pointer">
                  {open ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat}</h2>
                  <div className="flex-1 flex items-center gap-2 ml-1">
                    <Progress value={stats.percent} className="h-1.5 flex-1 max-w-[120px] bg-muted [&>div]:bg-primary" />
                    <span className="text-xs text-muted-foreground">{stats.done}/{stats.total}</span>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3">
                  {catFiltered.map((item) => (
                    <div
                      key={item.id}
                      className={`group/card rounded-xl border p-4 transition-all ${
                        item.checked ? "bg-primary/5 border-primary/15 opacity-50" : "bg-card border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => toggleCheck(item.id, item.checked)}
                          className="mt-0.5 h-5 w-5 rounded-md border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium leading-tight ${item.checked ? "line-through text-muted-foreground/60" : "text-card-foreground"}`}>
                            {item.title}
                          </span>
                          <Textarea
                            value={item.memo}
                            onChange={(e) => handleMemoChange(item.id, e.target.value)}
                            placeholder="메모 입력..."
                            className="mt-2 min-h-[2.5rem] resize-none bg-muted/50 border-none text-xs placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/40"
                            rows={1}
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          {item.checked && <CheckCircle2 className="h-4 w-4 text-primary/60" />}
                          <button
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {catFiltered.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground/60 text-xs">해당하는 항목이 없습니다.</div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </main>
    </div>
  );
};

const Index = () => {
  return <ChecklistApp />;
};

export default Index;
