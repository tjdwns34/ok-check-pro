import { useState } from "react";
import { CheckCircle2, Filter, ChevronDown, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type CheckItem = {
  id: string;
  category: string;
  title: string;
  checked: boolean;
  memo: string;
};

const initialItems: CheckItem[] = [
  { id: "1", category: "월간 점검", title: "고객정보 접근권한 확인", checked: false, memo: "" },
  { id: "2", category: "월간 점검", title: "비밀번호 변경 여부", checked: false, memo: "" },
  { id: "3", category: "월간 점검", title: "문서 보관 상태", checked: false, memo: "" },
  { id: "4", category: "분기 점검", title: "시스템 로그 점검", checked: false, memo: "" },
  { id: "5", category: "분기 점검", title: "외부감사 자료 준비", checked: false, memo: "" },
  { id: "6", category: "분기 점검", title: "규정 변경사항 반영", checked: false, memo: "" },
];

type FilterType = "전체" | "완료" | "미완료";

const Index = () => {
  const [items, setItems] = useState<CheckItem[]>(initialItems);
  const [filter, setFilter] = useState<FilterType>("전체");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const completedCount = items.filter((i) => i.checked).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const toggleCheck = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  };

  const updateMemo = (id: string, memo: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, memo } : item)));
  };

  const filtered = items.filter((item) => {
    if (filter === "완료") return item.checked;
    if (filter === "미완료") return !item.checked;
    return true;
  });

  const categories = [...new Set(items.map((i) => i.category))];
  const filters: FilterType[] = ["전체", "완료", "미완료"];

  const isCategoryOpen = (cat: string) => openCategories[cat] !== false; // default open

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !isCategoryOpen(cat) }));
  };

  const getCategoryStats = (cat: string) => {
    const catItems = items.filter((i) => i.category === cat);
    const done = catItems.filter((i) => i.checked).length;
    return { done, total: catItems.length, percent: catItems.length > 0 ? (done / catItems.length) * 100 : 0 };
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            <span className="text-primary">OK금융</span> 업무 점검
          </h1>
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
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-primary transition-transform" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-primary transition-transform" />
                  )}
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat}</h2>
                  <div className="flex-1 flex items-center gap-2 ml-1">
                    <Progress value={stats.percent} className="h-1.5 flex-1 max-w-[120px] bg-muted [&>div]:bg-primary" />
                    <span className="text-xs text-muted-foreground">
                      {stats.done}/{stats.total}
                    </span>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3">
                  {catFiltered.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 transition-all ${
                        item.checked
                          ? "bg-primary/5 border-primary/15 opacity-50"
                          : "bg-card border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => toggleCheck(item.id)}
                          className="mt-0.5 h-5 w-5 rounded-md border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <span
                            className={`text-sm font-medium leading-tight ${
                              item.checked ? "line-through text-muted-foreground/60" : "text-card-foreground"
                            }`}
                          >
                            {item.title}
                          </span>
                          <Textarea
                            value={item.memo}
                            onChange={(e) => updateMemo(item.id, e.target.value)}
                            placeholder="메모 입력..."
                            className="mt-2 min-h-[2.5rem] resize-none bg-muted/50 border-none text-xs placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/40"
                            rows={1}
                          />
                        </div>
                        {item.checked && <CheckCircle2 className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />}
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

export default Index;
