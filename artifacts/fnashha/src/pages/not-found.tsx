import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Wrench, Home, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Wrench className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-8xl font-black text-primary mb-4">404</h1>
        <h2 className="text-2xl font-bold text-foreground mb-3">الصفحة غير موجودة</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى مكان آخر.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button className="font-bold gap-2" data-testid="button-home">
              <Home className="w-4 h-4" />
              العودة للرئيسية
            </Button>
          </Link>
          <button onClick={() => window.history.back()}>
            <Button variant="outline" className="font-bold gap-2">
              <ArrowRight className="w-4 h-4" />
              الصفحة السابقة
            </Button>
          </button>
        </div>
      </div>
    </div>
  );
}
