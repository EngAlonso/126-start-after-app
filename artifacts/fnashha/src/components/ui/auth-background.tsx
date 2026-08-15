import { usePageBg } from "@/contexts/page-backgrounds-context";
import { cldUrl } from "@/lib/cloudinary";

interface AuthBackgroundProps {
  slug: string;
  defaultSrc?: string;
}

export function AuthBackground({ slug, defaultSrc }: AuthBackgroundProps) {
  const settings = usePageBg(slug);

  const imageUrl = settings !== null ? settings.imageUrl : (defaultSrc ?? null);
  const enabled = settings?.enabled ?? true;
  const overlayOpacity = settings?.overlayOpacity ?? 48;
  const position = settings?.position ?? "center";
  const size = settings?.size ?? "cover";
  const repeat = settings?.repeat ?? "no-repeat";
  const attachment = settings?.attachment ?? "scroll";

  if (!enabled || !imageUrl) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        backgroundImage: `url(${cldUrl(imageUrl, { width: 1920 })})`,
        backgroundSize: size,
        backgroundPosition: position,
        backgroundRepeat: repeat,
        backgroundAttachment: attachment,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `rgba(0,0,0,${(overlayOpacity / 100).toFixed(2)})`,
        }}
      />
    </div>
  );
}
