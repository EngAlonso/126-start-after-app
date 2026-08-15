import { useState } from "react";
import {
  useListGovernorates, getListGovernoratesQueryKey, useCreateGovernorate, useDeleteGovernorate,
  useListAreas, getListAreasQueryKey, useDeleteArea,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { PlusCircle, Trash2, Pencil, Check, X } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiFetch(path: string, method: string, body?: any, token?: string) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === "DELETE" && res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطأ في الخادم");
  return data;
}

export default function AdminLocations() {
  const { toast } = useToast();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"gov" | "area">("gov");

  const [newGovName, setNewGovName] = useState("");
  const [newGovNameAr, setNewGovNameAr] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaNameAr, setNewAreaNameAr] = useState("");
  const [newAreaGovId, setNewAreaGovId] = useState("");
  const [newAreaExtraPoints, setNewAreaExtraPoints] = useState("0");

  const [editingArea, setEditingArea] = useState<{ id: number; extraPoints: string } | null>(null);
  const [savingArea, setSavingArea] = useState(false);

  const { data: governorates = [] } = useListGovernorates({ query: { queryKey: getListGovernoratesQueryKey() } });
  const { data: areas = [] } = useListAreas(undefined as any, { query: { queryKey: getListAreasQueryKey() } });

  const createGovMutation = useCreateGovernorate();
  const deleteGovMutation = useDeleteGovernorate();
  const deleteAreaMutation = useDeleteArea();

  const govs = Array.isArray(governorates) ? governorates : [];
  const allAreas = Array.isArray(areas) ? areas : [];

  const addGov = () => {
    if (!newGovName || !newGovNameAr) return;
    createGovMutation.mutate(
      { data: { name: newGovName, nameAr: newGovNameAr } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGovernoratesQueryKey() });
          toast({ title: "تم إضافة المحافظة" });
          setNewGovName(""); setNewGovNameAr("");
        },
      }
    );
  };

  const addArea = async () => {
    if (!newAreaName || !newAreaNameAr || !newAreaGovId) return;
    try {
      await apiFetch("/areas", "POST", {
        name: newAreaName,
        nameAr: newAreaNameAr,
        governorateId: parseInt(newAreaGovId),
        extraPoints: parseInt(newAreaExtraPoints) || 0,
      }, token || "");
      queryClient.invalidateQueries({ queryKey: getListAreasQueryKey() });
      toast({ title: "تم إضافة المنطقة" });
      setNewAreaName(""); setNewAreaNameAr(""); setNewAreaExtraPoints("0");
    } catch (err: any) {
      toast({ title: "خطأ في الإضافة", description: err.message, variant: "destructive" });
    }
  };

  const saveAreaExtraPoints = async () => {
    if (!editingArea) return;
    setSavingArea(true);
    try {
      await apiFetch(`/areas/${editingArea.id}`, "PATCH", {
        extraPoints: parseInt(editingArea.extraPoints) || 0,
      }, token || "");
      queryClient.invalidateQueries({ queryKey: getListAreasQueryKey() });
      toast({ title: "تم تحديث النقاط الإضافية" });
      setEditingArea(null);
    } catch (err: any) {
      toast({ title: "خطأ في التحديث", description: err.message, variant: "destructive" });
    } finally {
      setSavingArea(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">إدارة المناطق</h1>
      </div>

      <div className="flex gap-2 mb-5">
        <Button variant={tab === "gov" ? "default" : "outline"} size="sm" onClick={() => setTab("gov")}>
          المحافظات ({govs.length})
        </Button>
        <Button variant={tab === "area" ? "default" : "outline"} size="sm" onClick={() => setTab("area")}>
          المناطق ({allAreas.length})
        </Button>
      </div>

      {tab === "gov" && (
        <>
          <div className="flex gap-2 mb-4">
            <Input value={newGovNameAr} onChange={(e) => setNewGovNameAr(e.target.value)} placeholder="الاسم بالعربي" data-testid="input-gov-name-ar" />
            <Input value={newGovName} onChange={(e) => setNewGovName(e.target.value)} placeholder="English name" data-testid="input-gov-name" />
            <Button onClick={addGov} disabled={createGovMutation.isPending} data-testid="button-add-gov">
              <PlusCircle className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {govs.map((g: any) => (
              <Card key={g.id} data-testid={`row-gov-${g.id}`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{g.nameAr}</p>
                    <p className="text-xs text-muted-foreground">{g.name}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteGovMutation.mutate({ id: g.id } as any, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListGovernoratesQueryKey() }) })}
                    data-testid={`button-delete-gov-${g.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "area" && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Input value={newAreaNameAr} onChange={(e) => setNewAreaNameAr(e.target.value)} placeholder="الاسم بالعربي *" data-testid="input-area-name-ar" />
            <Input value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="English name *" data-testid="input-area-name" />
            <Select value={newAreaGovId} onValueChange={setNewAreaGovId}>
              <SelectTrigger data-testid="select-gov">
                <SelectValue placeholder="المحافظة *" />
              </SelectTrigger>
              <SelectContent>
                {govs.map((g: any) => <SelectItem key={g.id} value={g.id.toString()}>{g.nameAr}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="number"
                value={newAreaExtraPoints}
                onChange={(e) => setNewAreaExtraPoints(e.target.value)}
                placeholder="نقاط إضافية"
                data-testid="input-area-extra-points"
                min="0"
              />
              <Button onClick={addArea} data-testid="button-add-area">
                <PlusCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {allAreas.map((a: any) => (
              <Card key={a.id} data-testid={`row-area-${a.id}`}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{a.nameAr}</p>
                    <p className="text-xs text-muted-foreground">{a.governorate?.nameAr || a.name}</p>
                  </div>

                  {editingArea && editingArea.id === a.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">نقاط إضافية:</span>
                      <Input
                        type="number"
                        value={editingArea.extraPoints}
                        onChange={(e) => setEditingArea({ ...editingArea, extraPoints: e.target.value })}
                        className="w-20 h-7 text-xs text-center"
                        min="0"
                        autoFocus
                        data-testid={`input-extra-points-${a.id}`}
                      />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={saveAreaExtraPoints} disabled={savingArea}>
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingArea(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={a.extraPoints > 0 ? "default" : "secondary"}
                        className="text-xs cursor-pointer"
                        onClick={() => setEditingArea({ id: a.id, extraPoints: String(a.extraPoints ?? 0) })}
                        data-testid={`badge-extra-points-${a.id}`}
                        title="انقر لتعديل النقاط الإضافية"
                      >
                        +{a.extraPoints ?? 0} نقطة
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => setEditingArea({ id: a.id, extraPoints: String(a.extraPoints ?? 0) })}
                        data-testid={`button-edit-area-${a.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => deleteAreaMutation.mutate({ id: a.id } as any, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAreasQueryKey() }) })}
                        data-testid={`button-delete-area-${a.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
