import { useBranding } from "@/contexts/branding-context";
import { CldImg } from "@/components/ui/cld-img";

interface SiteLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function SiteLogo({ size = 38, className, style }: SiteLogoProps) {
  const { logoUrl, siteNameAr } = useBranding();
  return (
    <CldImg
      src={logoUrl || "/assets/logo.png"}
      alt={siteNameAr}
      width={size * 2}
      eager
      style={{ width: size, height: size, objectFit: "cover", display: "block", ...style }}
      className={className}
    />
  );
}
