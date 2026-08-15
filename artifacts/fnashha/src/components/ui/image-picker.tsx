import { useRef, useCallback } from "react";

interface ImagePickerProps {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  /** @deprecated No longer used — native OS chooser handles camera vs. gallery. */
  captureMode?: "user" | "environment";
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * ImagePicker — wraps any trigger element and opens the platform's native
 * file/image chooser on click.
 *
 * On Android and iOS the browser automatically presents the OS-level action
 * sheet ("Camera / Photos / Files") when `capture` is NOT set on the input.
 * We rely on that native behaviour instead of replacing it with a custom UI.
 * A custom fallback drawer is only shown when the platform provides no native
 * chooser — which no modern mobile browser requires.
 */
export function ImagePicker({
  onFiles,
  multiple = false,
  accept = "image/jpeg,image/jpg,image/png,image/webp",
  disabled = false,
  children,
  className,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (e.target.value) e.target.value = "";
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  const handleTrigger = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <>
      <span
        className={className}
        onClick={handleTrigger}
        style={{ display: "contents", cursor: disabled ? "not-allowed" : "pointer" }}
      >
        {children}
      </span>

      {/*
       * No `capture` attribute → the browser/OS shows its own native chooser,
       * which on Android/iOS already includes "Camera" and "Gallery" options.
       * Adding `capture` would force the camera and skip the chooser entirely.
       */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );
}
