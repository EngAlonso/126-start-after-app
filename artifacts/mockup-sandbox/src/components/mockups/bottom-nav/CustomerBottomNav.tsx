import { useState } from "react";
import { Home, ClipboardList, MessageCircle, Bell, User, PlusCircle, ChevronLeft, Search } from "lucide-react";

const tabs = [
  { id: "home",     icon: Home,          label: "الرئيسية",  badge: 0 },
  { id: "requests", icon: ClipboardList, label: "طلباتي",    badge: 0 },
  { id: "messages", icon: MessageCircle, label: "رسائل",     badge: 3 },
  { id: "notifs",   icon: Bell,          label: "إشعارات",   badge: 7 },
  { id: "profile",  icon: User,          label: "حسابي",     badge: 0 },
];

function HomeScreen() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs text-muted-foreground">أهلاً،</p>
        <h1 className="text-base font-bold">أحمد محمد</h1>
      </div>
      <div className="mx-4 mb-3 rounded-xl overflow-hidden bg-gradient-to-l from-primary to-primary/70 p-4 min-h-[90px] flex flex-col justify-between">
        <p className="text-white font-semibold text-sm">احصل على أفضل الفنيين</p>
        <button className="self-start bg-white text-primary text-xs font-bold rounded-full px-3 py-1 mt-2">اطلب الآن</button>
      </div>
      <div className="mx-4 mb-3 grid grid-cols-3 gap-2">
        {["سباكة","كهرباء","نجارة","تكييف","دهانات","أخرى"].map((s) => (
          <div key={s} className="bg-muted/60 rounded-xl p-3 flex flex-col items-center gap-1.5 cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-base">🔧</span>
            </div>
            <span className="text-xs font-medium text-center">{s}</span>
          </div>
        ))}
      </div>
      <div className="mx-4 mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">الطلبات النشطة</span>
        <span className="text-xs text-primary">عرض الكل</span>
      </div>
      <div className="mx-4 space-y-2 mb-4">
        <div className="border border-border rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs bg-yellow-100 text-yellow-800 font-medium px-2 py-0.5 rounded-full">بانتظار العروض</span>
            <span className="text-[10px] text-muted-foreground">منذ يومين</span>
          </div>
          <p className="text-xs font-medium line-clamp-2">إصلاح تسريب في حمام الدور الأول</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">الرياض — حي النزهة</span>
            <button className="text-[11px] text-primary font-medium flex items-center gap-0.5">التفاصيل <ChevronLeft className="w-3 h-3" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestsScreen() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold">طلباتي</h1>
          <p className="text-xs text-muted-foreground">جميع طلبات الخدمة</p>
        </div>
        <button className="bg-primary text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5">
          <PlusCircle className="w-3.5 h-3.5" />
          طلب جديد
        </button>
      </div>
      <div className="mx-4 space-y-2">
        {[
          { status: "بانتظار العروض", color: "bg-yellow-100 text-yellow-800", desc: "إصلاح تسريب في حمام الدور الأول", date: "٢٤ يونيو" },
          { status: "تم الاختيار", color: "bg-green-100 text-green-800", desc: "تركيب مكيف سبليت ٢٤ ألف وحدة", date: "٢٠ يونيو" },
          { status: "مكتمل", color: "bg-gray-100 text-gray-600", desc: "دهان غرفة المعيشة", date: "١٠ يونيو" },
        ].map((r, i) => (
          <div key={i} className="border border-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.color}`}>{r.status}</span>
              <span className="text-[10px] text-muted-foreground">{r.date}</span>
            </div>
            <p className="text-xs font-medium">{r.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyMessages() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-base font-bold">رسائل</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-6 text-center pb-20">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
          <MessageCircle className="w-7 h-7 opacity-40" />
        </div>
        <p className="text-sm font-semibold mb-1">لا توجد رسائل بعد</p>
        <p className="text-xs text-muted-foreground leading-relaxed">ستظهر محادثاتك مع الفنيين هنا بعد اختيار فني لطلبك</p>
      </div>
    </div>
  );
}

const screenMap: Record<string, React.ReactNode> = {
  home:     <HomeScreen />,
  requests: <RequestsScreen />,
  messages: <EmptyMessages />,
  notifs:   (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 pt-4 pb-3"><h1 className="text-base font-bold">الإشعارات</h1></div>
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground pb-20 text-center px-6">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3"><Bell className="w-7 h-7 opacity-40" /></div>
        <p className="text-sm font-semibold mb-1">لا توجد إشعارات</p>
        <p className="text-xs text-muted-foreground leading-relaxed">ستصلك إشعارات عند استقبال عروض أو تحديثات على طلباتك</p>
      </div>
    </div>
  ),
  profile:  (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="px-4 pt-4 pb-3"><h1 className="text-base font-bold">حسابي</h1></div>
      <div className="mx-4 flex items-center gap-3 p-3 bg-primary/5 rounded-xl mb-4 border border-primary/15">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"><User className="w-6 h-6 text-primary" /></div>
        <div><p className="font-semibold text-sm">أحمد محمد</p><p className="text-xs text-muted-foreground">05XXXXXXXX</p></div>
      </div>
      <div className="mx-4 space-y-1 mb-4">
        {["تعديل الملف الشخصي","الدعم والمساعدة","اتصل بنا","تسجيل الخروج"].map((item, i) => (
          <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${i === 3 ? "text-red-500" : ""} border border-border`}>
            <span className="text-sm">{item}</span>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  ),
};

export default function CustomerBottomNav() {
  const [active, setActive] = useState("home");

  return (
    <div className="w-[390px] h-[844px] bg-background flex flex-col overflow-hidden rounded-[40px] border-2 border-border shadow-2xl" dir="rtl">
      {/* Status bar mockup */}
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
      <div className="flex-shrink-0 bg-background border-t border-border pb-4 pt-1 px-2 safe-area-bottom">
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
