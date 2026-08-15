import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRef, useState, useEffect } from "react";
import { useGetMe, getGetMeQueryKey, useUpdateUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { User, Camera, Lock, HeadphonesIcon, ChevronLeft, Phone, LogOut, Coins, Gift } from "lucide-react";
import { uploadFileLocal } from "@/lib/uploadMedia";
import { ImagePicker } from "@/components/ui/image-picker";
import { Link, useLocation } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { useLoyaltyConfig, useLoyaltyWallet } from "@/hooks/use-loyalty";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const schema = z.object({
  fullName: z.string().min(3),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(
  (data) => { if (data.newPassword && !data.currentPassword) return false; return true; },
  { message: "يرجى إدخال كلمة المرور الحالية", path: ["currentPassword"] }
).refine(
  (data) => { if (data.newPassword && data.newPassword.length < 6) return false; return true; },
  { message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل", path: ["newPassword"] }
).refine(
  (data) => { if (data.newPassword && data.newPassword !== data.confirmPassword) return false; return true; },
  { message: "كلمة المرور الجديدة وتأكيدها غير متطابقين", path: ["confirmPassword"] }
);

function LoyaltySection() {
  const { data: config } = useLoyaltyConfig();
  const { data: wallet } = useLoyaltyWallet();

  if (!config?.loyaltyEnabled) return null;

  const coins = (wallet as any)?.availableCoins ?? 0;
  const coinName = config.coinName;

  return (
    <div className="mt-6 pt-5 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Coins className="w-4 h-4 text-yellow-600" />
        <h3 className="text-sm font-semibold">عملات فنشها</h3>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <Link href="/customer/wallet">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors cursor-pointer">
            <Coins className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-xs text-yellow-700">رصيدك</p>
              <p className="font-bold text-yellow-800">{coins.toLocaleString()} {coinName}</p>
            </div>
          </div>
        </Link>
        <Link href="/customer/referral">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
            <Gift className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">الإحالة</p>
              <p className="font-bold text-primary">ادعُ صديقاً</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default function CustomerProfile() {
  const { currentUser, token, logout } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const logoutMutation = useLogout();
  const [showDelete, setShowDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const updateMutation = useUpdateUser();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (me) {
      const user = me as any;
      form.reset({ fullName: user.fullName || "", email: user.email || "", currentPassword: "", newPassword: "", confirmPassword: "" });
    }
  }, [me]);

  const onSubmit = (values: z.infer<typeof schema>) => {
    const { confirmPassword: _, ...data } = values;
    updateMutation.mutate(
      { id: currentUser!.id, data: data as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({ title: "تم حفظ التغييرات" });
        },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      }
    );
  };

  const handlePhotoChange = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "الملف كبير جداً", description: "الحجم الأقصى 5 ميجابايت", variant: "destructive" });
      return;
    }
    try {
      const url = await uploadFileLocal(file, token || null, "customers");
      updateMutation.mutate(
        { id: currentUser!.id, data: { profileImage: url } as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            toast({ title: "تم تحديث صورة الملف الشخصي" });
          },
          onError: () => toast({ title: "خطأ في تحديث الصورة", variant: "destructive" }),
        }
      );
    } catch {
      toast({ title: "خطأ في رفع الصورة", variant: "destructive" });
    }
  };

  const user = me as any;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "تم حذف حسابك بنجاح" });
      logout();
      navigate("/");
    } catch {
      toast({ title: "خطأ في حذف الحساب", variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const handleMobileLogout = () => {
    logoutMutation.mutate(undefined as any);
    logout();
  };

  return (
    <div className="p-3 md:p-6 max-w-xl mx-auto">
      <h1 className="text-lg md:text-2xl font-bold mb-3 md:mb-6">الملف الشخصي</h1>

      {/* Mobile-only: quick links (support, contact, logout) */}
      <div className="md:hidden space-y-1.5 mb-4">
        <Link href="/customer/support" style={{ textDecoration: "none" }}>
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <HeadphonesIcon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">الدعم والمساعدة</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
        <Link href="/contact" style={{ textDecoration: "none" }}>
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">اتصل بنا</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
        <button
          onClick={handleMobileLogout}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-destructive/30 bg-card hover:bg-destructive/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <LogOut className="w-5 h-5 text-destructive" />
            <span className="text-sm font-medium text-destructive">تسجيل الخروج</span>
          </div>
        </button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-3">
              {user?.profileImage ? (
                <img
                  src={user.profileImage}
                  alt="صورة الملف الشخصي"
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-10 h-10 text-primary" />
                </div>
              )}
              <ImagePicker onFiles={handlePhotoChange} captureMode="user" accept="image/jpeg,image/jpg,image/png,image/webp">
                <button
                  type="button"
                  className="absolute bottom-0 left-0 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                  title="تغيير الصورة"
                  data-testid="button-change-photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </ImagePicker>
            </div>
            <p className="font-bold text-lg">{user?.fullName}</p>
            <p className="text-muted-foreground text-sm">{user?.mobile}</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم الكامل</FormLabel>
                  <FormControl><Input data-testid="input-fullname" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني (اختياري)</FormLabel>
                  <FormControl><Input type="email" placeholder="example@mail.com" data-testid="input-email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  تغيير كلمة المرور
                </p>
                <div className="space-y-3">
                  <FormField control={form.control} name="currentPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور الحالية</FormLabel>
                      <FormControl><Input type="password" placeholder="••••••" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="newPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>كلمة المرور الجديدة</FormLabel>
                      <FormControl><Input type="password" placeholder="••••••" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>تأكيد كلمة المرور الجديدة</FormLabel>
                      <FormControl><Input type="password" placeholder="••••••" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
              <Button type="submit" className="w-full font-bold" disabled={updateMutation.isPending} data-testid="button-save">
                {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <LoyaltySection />

      {/* ── Delete Account ─────────────────────────── */}
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-sm font-semibold text-destructive mb-1">منطقة الخطر</h3>
        <p className="text-xs text-muted-foreground mb-3">
          حذف حسابك سيؤدي إلى إلغاء وصولك نهائياً. هذا الإجراء لا يمكن التراجع عنه.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => setShowDelete(true)}
          data-testid="button-delete-account"
        >
          حذف الحساب
        </Button>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف حسابك؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف حسابك بشكل دائم ولن تتمكن من استعادته. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="سبب الحذف (اختياري)"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            className="text-sm mt-2"
            rows={3}
          />
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "جاري الحذف..." : "تأكيد الحذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
