import { API_BASE } from "./api-config";

function _doUpload(
  endpoint: string,
  file: File | Blob,
  token: string | null,
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append(
      "file",
      file instanceof File
        ? file
        : new File([file], "recording.webm", { type: file.type || "audio/webm" })
    );

    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 95));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          onProgress?.(100);
          resolve(data.url);
        } catch {
          reject(new Error("Invalid response"));
        }
      } else {
        let msg = "فشل رفع الملف";
        try {
          msg = JSON.parse(xhr.responseText).error || msg;
        } catch {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("خطأ في الشبكة")));
    xhr.send(formData);
  });
}

export function uploadFile(
  file: File | Blob,
  token: string | null,
  onProgress?: (pct: number) => void
): Promise<string> {
  return _doUpload(`${API_BASE}/api/upload`, file, token, onProgress);
}

export function uploadFileLocal(
  file: File | Blob,
  token: string | null,
  category: string = "requests",
  onProgress?: (pct: number) => void
): Promise<string> {
  return _doUpload(
    `${API_BASE}/api/upload/user?category=${category}`,
    file,
    token,
    onProgress
  ).then((url) =>
    url.startsWith("/uploads/") ? `${API_BASE}${url}` : url
  );
}
