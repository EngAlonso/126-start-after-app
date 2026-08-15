import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, KeyRound, Phone, Lock } from "lucide-react";
import { API_BASE } from "@/lib/api-config";

async function apiCall(path: string, method: string, body: any, token: string) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

export default function FounderSettings() {
  const { token } = useAuth();
  const { toast } = useToast();

  // Password change state
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwLoading, setPwLoading] = useState(false);

  // Phone change state
  const [phoneForm, setPhoneForm] = useState({ newPhone: "", currentPassword: "" });
  const [phoneLoading, setPhoneLoading] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({ title: "كلمتا المرور غير متطابقتان", variant: "destructive" });
      return;
    }
    if (pwForm.newPassword.length < 8) {
      toast({ title: "كلمة المرور يجب أن تكون 8 أحرف على الأقل", variant: "destructive" });
      return;
    }
    setPwLoading(true);
    try {
      await apiCall(
        "/founder/settings",
        "PATCH",
        { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
        token!
      );
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      toast({ title: err.message || "فشل تغيير كلمة المرور", variant: "destructive" });
    } finally {
      setPwLoading(false);
    }
  };

  const handlePhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneForm.newPhone.trim()) {
      toast({ title: "رقم الهاتف مطلوب", variant: "destructive" });
      return;
    }
    if (!phoneForm.currentPassword) {
      toast({ title: "كلمة المرور الحالية مطلوبة للتحقق", variant: "destructive" });
      return;
    }
    setPhoneLoading(true);
    try {
      await apiCall(
        "/founder/settings",
        "PATCH",
        { newPhone: phoneForm.newPhone.trim(), currentPassword: phoneForm.currentPassword },
        token!
      );
      toast({ title: "تم تغيير رقم الهاتف بنجاح" });
      setPhoneForm({ newPhone: "", currentPassword: "" });
    } catch (err: any) {
      toast({ title: err.message || "فشل تغيير رقم الهاتف", variant: "destructive" });
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">إعدادات الحساب</h1>
          <p className="text-sm text-muted-foreground">إعدادات الأمان والخصوصية</p>
        </div>
      </div>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">تغيير كلمة المرور</CardTitle>
          </div>
          <CardDescription>يجب إدخال كلمة المرور الحالية للتأكيد</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="أدخل كلمة المرور الحالية"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="8 أحرف على الأقل"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="أعد إدخال كلمة المرور الجديدة"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                required
              />
            </div>
            <Button type="submit" disabled={pwLoading} className="w-full">
              {pwLoading ? "جارٍ الحفظ..." : "تغيير كلمة المرور"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Phone Number */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">تغيير رقم الهاتف</CardTitle>
          </div>
          <CardDescription>
            يظل الحساب حساب المؤسس بعد تغيير رقم الهاتف
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePhoneChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPhone">رقم الهاتف الجديد</Label>
              <Input
                id="newPhone"
                type="tel"
                placeholder="01xxxxxxxxx"
                value={phoneForm.newPhone}
                onChange={(e) => setPhoneForm((f) => ({ ...f, newPhone: e.target.value }))}
                required
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneCurrentPassword">كلمة المرور للتحقق</Label>
              <Input
                id="phoneCurrentPassword"
                type="password"
                placeholder="أدخل كلمة المرور الحالية"
                value={phoneForm.currentPassword}
                onChange={(e) => setPhoneForm((f) => ({ ...f, currentPassword: e.target.value }))}
                required
              />
            </div>
            <Button type="submit" disabled={phoneLoading} className="w-full">
              {phoneLoading ? "جارٍ الحفظ..." : "تغيير رقم الهاتف"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security note */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800" dir="rtl">
        <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>هذه الإعدادات مرئية للمؤسس فقط. لا يستطيع أي مسؤول آخر الوصول إليها أو تعديلها.</p>
      </div>
    </div>
  );
}
