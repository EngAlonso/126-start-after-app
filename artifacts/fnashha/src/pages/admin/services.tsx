import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListServices, getListServicesQueryKey,
  useCreateService, useUpdateService, useDeleteService,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Pencil, Trash2, Upload, X, RefreshCw, ImageIcon, Circle, Square } from "lucide-react";
import { uploadFile } from "@/lib/uploadMedia";

const getToken = () => localStorage.getItem("fnashha_token") || "";

const ACCEPTED_TYPES = ["image/png", "image/svg+xml", "image/webp", "image/jpeg", "image/jpg"];
const ACCEPTED_ATTR = ".png,.svg,.webp,.jpg,.jpeg";

const schema = z.object({
  name: z.string().min(2),
  nameAr: z.string().min(2, "الاسم العربي مطلوب"),
  icon: z.string().optional(),
  image: z.string().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().optional(),
  iconSize: z.number().min(50).max(300).optional(),
  iconShape: z.string().optional(),
  titleSize: z.number().min(50).max(300).optional(),
});

function ServiceDisplayIcon({ service }: { service: any }) {
  const size = service.iconSize ?? 100;
  const shape = service.iconShape ?? "square";
  const px = Math.round(32 * (size / 100));
  if (service.image) {
    return (
      <img
        src={service.image}
        alt={service.nameAr}
        style={{
          width: px,
          height: px,
          borderRadius: shape === "circle" ? "50%" : "8px",
          objectFit: "contain",
        }}
      />
    );
  }
  return <span style={{ fontSize: Math.round(24 * (size / 100)) }}>{service.icon || "🔧"}</span>;
}

export default function AdminServices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: services = [], isLoading } = useListServices(undefined, {
    query: { queryKey: getListServicesQueryKey() },
  });

  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const deleteMutation = useDeleteService();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", nameAr: "", icon: "", image: "", isActive: true, displayOrder: 0, iconSize: 100, iconShape: "square", titleSize: 100 },
  });

  const watchedImage = form.watch("image");
  const watchedIconShape = form.watch("iconShape");
  const watchedIconSize = form.watch("iconSize");

  const [uploadingIcon, setUploadingIcon] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "نوع الملف غير مدعوم", description: "يُسمح بـ PNG، SVG، WEBP، JPG، JPEG فقط", variant: "destructive" });
      return;
    }
    e.target.value = "";
    setUploadingIcon(true);
    uploadFile(file, getToken())
      .then((url) => form.setValue("image", url, { shouldDirty: true }))
      .catch(() => toast({ title: "فشل رفع الصورة", variant: "destructive" }))
      .finally(() => setUploadingIcon(false));
  };

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: "", nameAr: "", icon: "", image: "", isActive: true, displayOrder: 0, iconSize: 100, iconShape: "square", titleSize: 100 });
    setShowForm(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    form.reset({
      name: s.name,
      nameAr: s.nameAr,
      icon: s.icon || "",
      image: s.image || "",
      isActive: s.isActive ?? true,
      displayOrder: s.displayOrder || 0,
      iconSize: s.iconSize ?? 100,
      iconShape: s.iconShape ?? "square",
      titleSize: s.titleSize ?? 100,
    });
    setShowForm(true);
  };

  const onSubmit = (values: z.infer<typeof schema>) => {
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: values as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
            toast({ title: "تم الحفظ" });
            setShowForm(false);
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: values as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
            toast({ title: "تم إضافة الخدمة" });
            setShowForm(false);
          },
        }
      );
    }
  };

  const handleToggleActive = async (s: any) => {
    setTogglingId(s.id);
    updateMutation.mutate(
      { id: s.id, data: { ...s, isActive: !s.isActive } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
          toast({ title: !s.isActive ? "تم تفعيل الخدمة" : "تم إخفاء الخدمة" });
        },
        onSettled: () => setTogglingId(null),
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    deleteMutation.mutate(
      { id } as any,
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
          toast({ title: "تم الحذف" });
        },
      }
    );
  };

  const previewSize = Math.round(48 * ((watchedIconSize ?? 100) / 100));

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">الخدمات</h1>
          <p className="text-muted-foreground text-sm">{(services as any[]).length} خدمة مسجلة</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-service" className="sm:self-start">
          <PlusCircle className="w-4 h-4 ms-2" />
          إضافة خدمة
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">{editing ? "تعديل الخدمة" : "إضافة خدمة جديدة"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Names row */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="nameAr" render={({ field }) => (
                    <FormItem>
                      <FormLabel>الاسم العربي *</FormLabel>
                      <FormControl><Input placeholder="كهرباء" data-testid="input-name-ar" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>الاسم الإنجليزي *</FormLabel>
                      <FormControl><Input placeholder="Electricity" data-testid="input-name" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Controls row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <FormField control={form.control} name="icon" render={({ field }) => (
                    <FormItem>
                      <FormLabel>رمز تعبيري (احتياطي)</FormLabel>
                      <FormControl><Input placeholder="⚡" data-testid="input-icon" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="displayOrder" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ترتيب العرض</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          data-testid="input-display-order"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="iconSize" render={({ field }) => (
                    <FormItem>
                      <FormLabel>حجم الأيقونة</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            min={50}
                            max={300}
                            placeholder="100"
                            data-testid="input-icon-size"
                            {...field}
                            value={field.value ?? 100}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              field.onChange(isNaN(val) ? 100 : val);
                            }}
                            className="pe-8"
                          />
                          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="iconShape" render={({ field }) => (
                    <FormItem>
                      <FormLabel>شكل الأيقونة</FormLabel>
                      <Select value={field.value ?? "square"} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-icon-shape">
                            <SelectValue placeholder="مربع" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="square">
                            <div className="flex items-center gap-2">
                              <Square className="w-3.5 h-3.5" />
                              مربع
                            </div>
                          </SelectItem>
                          <SelectItem value="circle">
                            <div className="flex items-center gap-2">
                              <Circle className="w-3.5 h-3.5" />
                              دائرة
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="titleSize" render={({ field }) => (
                    <FormItem>
                      <FormLabel>حجم اسم الخدمة</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            min={50}
                            max={300}
                            placeholder="100"
                            data-testid="input-title-size"
                            {...field}
                            value={field.value ?? 100}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              field.onChange(isNaN(val) ? 100 : val);
                            }}
                            className="pe-8"
                          />
                          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Icon upload section */}
                <div className="border rounded-xl p-4 bg-muted/30 space-y-3">
                  <p className="text-sm font-medium">أيقونة مخصصة (صورة)</p>
                  <p className="text-xs text-muted-foreground">PNG، SVG، WEBP، JPG، JPEG — إذا تم رفع صورة، ستُستخدم بدلاً من الرمز التعبيري</p>

                  {watchedImage ? (
                    <div className="flex items-center gap-4">
                      <div
                        className="border-2 border-primary/20 bg-white flex items-center justify-center overflow-hidden flex-shrink-0"
                        style={{
                          width: previewSize + 16,
                          height: previewSize + 16,
                          borderRadius: watchedIconShape === "circle" ? "50%" : "12px",
                        }}
                      >
                        <img
                          src={watchedImage}
                          alt="معاينة الأيقونة"
                          style={{ width: previewSize, height: previewSize, objectFit: "contain" }}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground">معاينة بالحجم والشكل المختار</p>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-replace-icon">
                            <RefreshCw className="w-3 h-3 ms-1" />
                            استبدال
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => form.setValue("image", "", { shouldDirty: true })}
                            data-testid="button-remove-icon"
                          >
                            <X className="w-3 h-3 ms-1" />
                            إزالة
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors w-full text-right"
                      data-testid="button-upload-icon"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">رفع أيقونة</p>
                        <p className="text-xs text-muted-foreground">اضغط لاختيار ملف صورة</p>
                      </div>
                      <Upload className="w-4 h-4 text-muted-foreground ms-auto" />
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_ATTR} className="hidden" onChange={handleFileChange} data-testid="input-icon-file" />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save">
                    {editing ? "حفظ التغييرات" : "إضافة"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {(services as any[]).map((s: any) => (
            <Card key={s.id} data-testid={`row-service-${s.id}`}>
              <CardContent className="p-3 md:p-4 flex items-center justify-between gap-2 md:gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                    <ServiceDisplayIcon service={s} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate text-sm">{s.nameAr}</p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <p className="text-xs text-muted-foreground">{s.name}</p>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">ترتيب: {s.displayOrder}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                  <Switch
                    checked={!!s.isActive}
                    onCheckedChange={() => handleToggleActive(s)}
                    disabled={togglingId === s.id}
                    data-testid={`toggle-active-${s.id}`}
                  />
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-${s.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)} data-testid={`button-delete-${s.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
