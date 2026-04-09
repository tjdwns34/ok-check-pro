import { useState, useCallback, useRef } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Plus, Trash2, X, LogOut } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("로그인에 실패했습니다");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            <span className="text-primary">OK금융</span> 업무 점검
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">로그인하여 업무 점검을 시작하세요</p>
        </div>
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {loading ? "로그인 중..." : "Google로 로그인"}
        </button>
      </div>
    </div>
  );
};

const ChecklistApp = () => {
  const { user, signOut } = useAuth();
  const [filter, setFilter] = useState<FilterType>("전체");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const queryClient = useQueryClient();

  const userName = user?.user_metadata?.full_name || user?.email || "사용자";
  const avatarUrl = user?.user_metadata?.avatar_url;

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
      const { error } = await supabase.from("checklist_items").insert({ title, category, user_id: user!.id });
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
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {/* User bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl} alt={userName} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                  {userName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">{userName}</span>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" />
              로그아웃
            </button>
          </div>

          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              <span className="text-primary">OK금융</span> 업무 점검
            </h1>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showAddForm ? "취소" : "항목 추가"}
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Progress value={progressPercent} className="h-2 flex-1 bg-muted [&>div]:bg-primary" />
            <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
              {completedCount}/{totalCount}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
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
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">로딩 중...</div>
      </div>
    );
  }

  return user ? <ChecklistApp /> : <LoginScreen />;
};

export default Index;
