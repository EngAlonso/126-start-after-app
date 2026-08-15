import { cldUrl, cldSrcSet, isCloudinaryUrl } from "@/lib/cloudinary";

interface CldImgProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src: string | null | undefined;
  width?: number;
  widths?: number[];
  sizes?: string;
  eager?: boolean;
}

/**
 * Drop-in replacement for <img> that automatically applies Cloudinary optimizations:
 * f_auto, q_auto, dpr_auto, c_limit (+ optional width cap).
 * Falls back gracefully for non-Cloudinary URLs.
 */
export function CldImg({
  src,
  width,
  widths,
  sizes,
  eager = false,
  alt = "",
  ...rest
}: CldImgProps) {
  const optimizedSrc = cldUrl(src, { width });

  const srcSet =
    widths && isCloudinaryUrl(src)
      ? cldSrcSet(src, widths)
      : undefined;

  return (
    <img
      src={optimizedSrc || undefined}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      {...rest}
    />
  );
}
