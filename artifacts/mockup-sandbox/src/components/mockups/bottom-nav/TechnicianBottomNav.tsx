import { useState } from "react";
import { LayoutDashboard, Search, MessageCircle, Wallet, User, ChevronLeft, Bell, Star, FileText, CheckCircle2 } from "lucide-react";

const tabs = [
  { id: "dashboard", icon: LayoutDashboard, label: "لوحتي",   badge: 0 },
  { id: "requests",  icon: Search,          label: "الطلبات", badge: 4 },
  { id: "messages",  icon: MessageCircle,   label: "رسائل",   badge: 2 },
  { id: "wallet",    icon: Wallet,          label: "محفظتي",  badge: 0 },
  { id: "profile",   icon: User,            label: "حسابي",   badge: 0 },
];

function DashboardScreen() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="px-4 pt-3 pb-2">
        <p className="text-xs text-muted-foreground">أهلاً،</p>
        <h1 className="text-base font-bold">محمد الفني</h1>
      </div>
      {/* Stat cards — horizontal scroll */}
      <div className="flex gap-3 px-4 pb-3 overflow-x-auto scrollbar-none">
        {[
          { label: "رصيد النقاط", value: "١٢٠", icon: Wallet, color: "bg-primary/10 text-primary" },
          { label: "طلبات نشطة", value: "٣",   icon: FileText, color: "bg-blue-50 text-blue-600" },
          { label: "تقييمي",      value: "٤.٨", icon: Star,    color: "bg-yellow-50 text-yellow-600" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex-shrink-0 bg-card border border-border rounded-xl p-3 flex items-center gap-2.5 w-[130px]">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-lg font-black leading-tight">{s.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>
      {/* Available requests */}
      <div className="mx-4 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold">الطلبات المتاحة</span>
          <span className="text-[10px] bg-primary/10 text-primary font-bold rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
            <Bell className="w-2.5 h-2.5" />4
          </span>
        </div>
        <span className="text-xs text-primary">تصفح الكل</span>
      </div>
      <div className="mx-4 space-y-2 mb-4">
        {[
          { desc: "إصلاح تسريب في دورة المياه", area: "الرياض — العليا" },
          { desc: "تركيب مكيف ٢٤ ألف وحدة", area: "الرياض — النزهة" },
        ].map((r, i) => (
          <div key={i} className="border border-primary/20 bg-primary/[0.02] rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{r.desc}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.area}</p>
            </div>
            <span className="text-[10px] bg-yellow-100 text-yellow-800 font-medium px-2 py-0.5 rounded-full flex-shrink-0">متاح</span>
          </div>
        ))}
      </div>
      {/* Recent offers */}
      <div className="mx-4 mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">عروضي الأخيرة</span>
        <span className="text-xs text-primary">عرض الكل</span>
      </div>
      <div className="mx-4 space-y-2 mb-4">
        {[
          { id: 12, price: "٢٥٠", status: "تم الاختيار", color: "bg-green-100 text-green-800" },
          { id: 9,  price: "١٨٠", status: "بانتظار العميل", color: "bg-yellow-100 text-yellow-800" },
        ].map((o) => (
          <div key={o.id} className="border border-border rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">طلب #{o.id}</p>
              <p className="text-[10px] text-primary mt-0.5">سباكة</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black">{o.price} ج</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${o.color}`}>{o.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestsScreen() {
  const [filter, setFilter] = useState("available");
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <h1 className="text-base font-bold">الطلبات</h1>
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          {[{ id: "available", label: "متاحة" }, { id: "active", label: "نشطة" }, { id: "completed", label: "مكتملة" }].map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${filter === f.id ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-4 space-y-2">
        {filter === "available" && [
          { desc: "إصلاح تسريب في دورة المياه", area: "العليا", badge: "متاح", color: "bg-yellow-100 text-yellow-800" },
          { desc: "تركيب مكيف ٢٤ ألف وحدة",    area: "النزهة", badge: "متاح", color: "bg-yellow-100 text-yellow-800" },
          { desc: "دهان جدران غرفة النوم",       area: "السليمانية", badge: "متاح", color: "bg-yellow-100 text-yellow-800" },
          { desc: "صيانة مضخة مياه",            area: "الملقا", badge: "متاح", color: "bg-yellow-100 text-yellow-800" },
        ].map((r, i) => (
          <div key={i} className="border border-primary/20 bg-primary/[0.02] rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{r.desc}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{r.area}</p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${r.color}`}>{r.badge}</span>
          </div>
        ))}
        {filter === "active" && [
          { desc: "تركيب مكيف سبليت", status: "تم الاختيار", color: "bg-green-100 text-green-800" },
          { desc: "إصلاح كهرباء", status: "قيد التنفيذ", color: "bg-blue-100 text-blue-800" },
          { desc: "سباكة حمام", status: "بانتظار الموافقة", color: "bg-orange-100 text-orange-800" },
        ].map((r, i) => (
          <div key={i} className="border border-border rounded-xl p-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium flex-1 min-w-0 truncate">{r.desc}</p>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${r.color}`}>{r.status}</span>
          </div>
        ))}
        {filter === "completed" && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 opacity-40" />
            </div>
            <p className="text-sm font-semibold mb-1">لا توجد طلبات مكتملة</p>
            <p className="text-xs text-muted-foreground leading-relaxed">ستظهر الطلبات المكتملة هنا</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WalletScreen() {
  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="px-4 pt-3 pb-3"><h1 className="text-base font-bold">المحفظة</h1></div>
      <div className="mx-4 bg-gradient-to-l from-primary to-primary/70 rounded-xl p-4 mb-4 text-white">
        <p className="text-xs opacity-80 mb-1">رصيدك الحالي</p>
        <p className="text-4xl font-black">١٢٠</p>
        <p className="text-xs opacity-80">نقطة</p>
      </div>
      <div className="mx-4 space-y-2">
        {[
          { label: "إيداع نقاط — طلب #14", amount: "+٥٠", color: "text-green-600", date: "٢٤ يونيو" },
          { label: "خصم عمولة — طلب #12", amount: "-١٥", color: "text-red-500",   date: "٢٠ يونيو" },
          { label: "إيداع نقاط — طلب #9",  amount: "+٨٠", color: "text-green-600", date: "١٥ يونيو" },
        ].map((t, i) => (
          <div key={i} className="border border-border rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">{t.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t.date}</p>
            </div>
            <span className={`text-sm font-black ${t.color}`}>{t.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const screenMap: Record<string, React.ReactNode> = {
  dashboard: <DashboardScreen />,
  requests:  <RequestsScreen />,
  messages: (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 pt-3 pb-3"><h1 className="text-base font-bold">رسائل</h1></div>
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-6 text-center pb-20">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
          <MessageCircle className="w-7 h-7 opacity-40" />
        </div>
        <p className="text-sm font-semibold mb-1">لا توجد رسائل</p>
        <p className="text-xs text-muted-foreground leading-relaxed">ستظهر محادثاتك مع العملاء هنا عند قبول طلب</p>
      </div>
    </div>
  ),
  wallet:  <WalletScreen />,
  profile: (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="px-4 pt-3 pb-3"><h1 className="text-base font-bold">حسابي</h1></div>
      <div className="mx-4 flex items-center gap-3 p-3 bg-primary/5 rounded-xl mb-4 border border-primary/15">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"><User className="w-6 h-6 text-primary" /></div>
        <div>
          <p className="font-semibold text-sm">محمد الفني</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-400" />
            <span className="text-xs text-muted-foreground">٤.٨ — (١٢ تقييم)</span>
          </div>
        </div>
      </div>
      <div className="mx-4 space-y-1 mb-4">
        {["الملف الشخصي","مناطق عملي","الدعم والمساعدة","اتصل بنا","تسجيل الخروج"].map((item, i) => (
          <div key={i} className={`flex items-center justify-between p-3 rounded-xl border border-border ${i === 4 ? "text-red-500" : ""}`}>
            <span className="text-sm">{item}</span>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  ),
};

export default function TechnicianBottomNav() {
  const [active, setActive] = useState("dashboard");

  return (
    <div className="w-[390px] h-[844px] bg-background flex flex-col overflow-hidden rounded-[40px] border-2 border-border shadow-2xl" dir="rtl">
      {/* Status bar */}
      <div className="flex items-center justify-between px-6 pt-3 pb-1 flex-shrink-0">
        <span className="text-xs font-semibold">9:41</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-2 border border-current rounded-sm"><div className="w-3/4 h-full bg-current rounded-sm" /></div>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-hidden relative">
        {screenMap[active]}
      </div>

      {/* Bottom navigation bar */}
      <div className="flex-shrink-0 bg-background border-t border-border pb-4 pt-1 px-2">
        <div className="flex items-stretch">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-colors relative"
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} strokeWidth={isActive ? 2.5 : 1.75} />
                  {tab.badge > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 min-w-[16px] h-4 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {tab.label}
                </span>
                {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
