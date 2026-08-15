import { useState, useRef, useEffect } from "react";
import { CldImg } from "@/components/ui/cld-img";
import {
  useListMessages, getListMessagesQueryKey,
  useSendMessage,
  useGetRequest, getGetRequestQueryKey,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, ArrowLeft, ImagePlus, X } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { MessageTick } from "@/components/ui/message-tick";
import { uploadFileLocal } from "@/lib/uploadMedia";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export default function CustomerChat({ requestId }: { requestId: string }) {
  const reqId = parseInt(requestId);
  const { currentUser, token } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMutation = useSendMessage();

  const { data: request } = useGetRequest(reqId, {
    query: { enabled: !!reqId, queryKey: getGetRequestQueryKey(reqId) },
  });

  const { data: messages = [], isLoading } = useListMessages(
    reqId,
    { query: { enabled: !!reqId, queryKey: getListMessagesQueryKey(reqId) } }
  );

  useEffect(() => {
    if (!token || !reqId) return;
    fetch(`${BASE_URL}/api/notifications/read-related`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ relatedId: reqId, types: ["new_message"] }),
    })
      .then(() => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqId]);

  // Mark received messages as read whenever the chat is open and messages change
  useEffect(() => {
    if (!token || !reqId || (messages as any[]).length === 0) return;
    fetch(`${BASE_URL}/api/requests/${reqId}/messages/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqId, (messages as any[]).length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "الملف كبير جداً (الحد الأقصى 5 ميجا)", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFileLocal(file, token || null, "chat");
      setImgUrl(url);
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendMsg = () => {
    if (!text.trim() && !imgUrl) return;
    const payload: any = imgUrl
      ? { content: text.trim() || "صورة", type: "image", imageUrl: imgUrl }
      : { content: text, type: "text" };

    // Optimistic update: add temp message instantly (WhatsApp-style)
    const tempId = `temp-${Date.now()}`;
    const tempMsg: any = {
      id: tempId,
      requestId: reqId,
      senderId: currentUser?.id,
      content: payload.content,
      type: payload.type,
      imageUrl: payload.imageUrl ?? null,
      isRead: false,
      createdAt: new Date().toISOString(),
      sender: { id: currentUser?.id, fullName: (currentUser as any)?.fullName ?? "", profileImage: null },
      _isOptimistic: true,
    };
    queryClient.setQueryData(getListMessagesQueryKey(reqId), (old: any = []) => [...old, tempMsg]);
    setText("");
    setImgUrl(null);

    sendMutation.mutate(
      { requestId: reqId, data: payload },
      {
        onSuccess: (newMsg: any) => {
          // Replace optimistic placeholder with real server message
          queryClient.setQueryData(getListMessagesQueryKey(reqId), (old: any = []) =>
            old.map((m: any) => (m.id === tempId ? { ...newMsg, sender: tempMsg.sender } : m))
          );
          // Background refresh to get full sender info from server
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(reqId) });
        },
        onError: () => {
          // Remove the optimistic placeholder on failure
          queryClient.setQueryData(getListMessagesQueryKey(reqId), (old: any = []) =>
            old.filter((m: any) => m.id !== tempId)
          );
          toast({ title: "فشل إرسال الرسالة", variant: "destructive" });
        },
      }
    );
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const req = request as any;
  const techName = req?.selectedTechnician?.fullName || "الفني";

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 100px)" }}>
      {/* Chat header */}
      <div className="px-3 md:px-4 pt-3 pb-2 border-b border-border flex-shrink-0">
        <Link href={`/customer/requests/${reqId}`}>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground mb-1 -mr-2 h-7 text-xs md:text-sm">
            <ArrowLeft className="w-3.5 h-3.5" />
            العودة إلى الطلب
          </Button>
        </Link>
        <h1 className="text-base md:text-xl font-bold leading-tight">المحادثة</h1>
        <p className="text-xs md:text-sm text-muted-foreground">طلب #{reqId} مع {techName}</p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
          </div>
        ) : (messages as any[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center px-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageCircle className="w-6 h-6 opacity-40" />
            </div>
            <p className="text-sm font-medium">ابدأ المحادثة</p>
            <p className="text-xs mt-1">أرسل رسالتك للفني</p>
          </div>
        ) : (
          (messages as any[]).map((msg: any) => {
            const isMe = msg.senderId === currentUser?.id;
            const isImage = msg.type === "image" && msg.imageUrl;
            return (
              <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")} data-testid={`message-${msg.id}`}>
                {!isMe && msg.sender?.profileImage && (
                  <CldImg src={msg.sender.profileImage} width={48} className="w-6 h-6 rounded-full object-cover me-1.5 flex-shrink-0 mt-1" alt="" />
                )}
                <div className={cn(
                  "max-w-[75%] md:max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-sm",
                  isMe
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {!isMe && msg.sender?.fullName && (
                    <p className="text-[10px] font-semibold mb-0.5 text-primary/80">{msg.sender.fullName}</p>
                  )}
                  {isImage ? (
                    <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={msg.imageUrl}
                        alt="صورة"
                        className="rounded-xl max-w-full max-h-48 object-contain mb-1 border"
                      />
                    </a>
                  ) : null}
                  {(!isImage || msg.content !== "صورة") && (
                    <p className="text-xs md:text-sm leading-relaxed">{msg.content}</p>
                  )}
                  <div className={cn("flex items-center gap-1 mt-0.5", isMe ? "justify-start" : "justify-end")}>
                    <p className="text-[10px] opacity-70">
                      {new Date(msg.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {isMe && (
                      <MessageTick
                        size="sm"
                        state={msg._isOptimistic ? "sending" : msg.isRead ? "read" : "delivered"}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Image preview bar */}
      {imgUrl && (
        <div className="px-3 md:px-4 pb-1 flex-shrink-0">
          <div className="relative inline-block">
            <img src={imgUrl} alt="" className="h-16 rounded-lg border object-contain" />
            <button
              onClick={() => setImgUrl(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 md:px-4 py-2.5 border-t border-border flex-shrink-0 bg-background">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageFile}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0 text-muted-foreground hover:text-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="إرسال صورة"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
          </Button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="اكتب رسالتك..."
            className="flex-1 h-9 md:h-10 text-sm"
            data-testid="input-message"
          />
          <Button
            onClick={sendMsg}
            disabled={(!text.trim() && !imgUrl) || sendMutation.isPending || uploading}
            className="h-9 w-9 md:h-10 md:w-10 p-0 flex-shrink-0"
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
