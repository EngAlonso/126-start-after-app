import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Send, Users, Wrench, Globe, Search, X } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const TARGET_OPTIONS = [
  { value: "all",          label: "جميع المستخدمين",   icon: Globe },
  { value: "customers",    label: "العملاء فقط",         icon: Users },
  { value: "technicians",  label: "الفنيون فقط",          icon: Wrench },
  { value: "specific",     label: "مستخدم محدد",         icon: Search },
];

interface UserResult {
  id: number;
  fullName: string;
  mobile: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  customer: "عميل",
  technician: "فني",
  admin: "موظف",
  super_admin: "سوبر أدمن",
};

export default function AdminNotifications() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [target, setTarget] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ count: number; title: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `${BASE_URL}/api/users?search=${encodeURIComponent(searchQuery.trim())}&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setSearchResults(list);
    } catch {
      toast({ title: "خطأ في البحث", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (user: UserResult) => {
    setSelectedUser(user);
    setUserId(user.id);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    setUserId(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "العنوان والمحتوى مطلوبان", variant: "destructive" });
      return;
    }
    if (target === "specific" && !userId) {
      toast({ title: "يرجى اختيار مستخدم", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const payload: Record<string, any> = { title, body, type: "announcement", target };
      if (target === "specific" && userId) payload.userId = String(userId);
      const res = await fetch(`${BASE_URL}/api/notifications/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
      setLastResult({ count: data.count, title });
      toast({ title: `✓ تم إرسال الإشعار إلى ${data.count} مستخدم` });
      setTitle("");
      setBody("");
      setSelectedUser(null);
      setUserId(null);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Megaphone className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">مركز الإشعارات</h1>
          <p className="text-sm text-muted-foreground">إرسال إشعارات جماعية أو مستهدفة للمستخدمين</p>
        </div>
      </div>

      {lastResult && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
          <Send className="w-4 h-4 flex-shrink-0" />
          <span>
            آخر إشعار أُرسل: <strong>"{lastResult.title}"</strong> — وصل إلى {lastResult.count} مستخدم
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">إرسال إشعار جديد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-sm font-semibold mb-2 block">الجمهور المستهدف</label>
            <div className="grid grid-cols-2 gap-2">
              {TARGET_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => { setTarget(value); handleClearUser(); }}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all text-right ${
                    target === value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {target === "specific" && (
            <div>
              <label className="text-sm font-semibold mb-1.5 block">بحث عن مستخدم</label>

              {selectedUser ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{selectedUser.fullName}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.mobile} — {ROLE_LABEL[selectedUser.role] || selectedUser.role}</p>
                  </div>
                  <button
                    onClick={handleClearUser}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="اسم أو رقم هاتف المستخدم"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <Button variant="outline" onClick={handleSearch} disabled={searching} className="flex-shrink-0">
                      {searching ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-border rounded-xl overflow-hidden divide-y divide-border">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-right"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{user.fullName?.[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.fullName}</p>
                            <p className="text-xs text-muted-foreground">{user.mobile} — {ROLE_LABEL[user.role] || user.role}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.length === 0 && searchQuery && !searching && (
                    <p className="text-xs text-muted-foreground mt-2">اضغط بحث للعثور على المستخدمين</p>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-semibold mb-1.5 block">عنوان الإشعار</label>
            <Input
              placeholder="مثال: تحديث مهم من فنشها"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-1.5 block">محتوى الإشعار</label>
            <Textarea
              placeholder="اكتب محتوى الإشعار هنا..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1 text-left">{body.length}/500</p>
          </div>

          <Button onClick={handleSend} disabled={sending} className="w-full gap-2 h-11 font-semibold">
            <Send className="w-4 h-4" />
            {sending ? "جاري الإرسال..." : "إرسال الإشعار"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
