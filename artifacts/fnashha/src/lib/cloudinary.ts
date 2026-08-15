const CLOUDINARY_ORIGIN = "https://res.cloudinary.com";

export function isCloudinaryUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith(CLOUDINARY_ORIGIN);
}

/**
 * Injects Cloudinary delivery optimizations into a URL.
 * - f_auto  → best format (WebP / AVIF)
 * - q_auto  → automatic quality
 * - dpr_auto → device pixel ratio
 * - c_limit → never upscale
 * - w_N     → cap width (optional)
 *
 * Safe to call on non-Cloudinary URLs; returns the original unchanged.
 * Safe to call on URLs that already have transformations; prepends to them.
 */
export function cldUrl(
  url: string | null | undefined,
  options: { width?: number } = {}
): string {
  if (!url || !isCloudinaryUrl(url)) return url ?? "";

  const { width } = options;

  const baseTx = ["f_auto", "q_auto", "dpr_auto"];
  if (width) {
    baseTx.push(`c_limit,w_${width}`);
  } else {
    baseTx.push("c_limit");
  }
  const txString = baseTx.join(",");

  return url.replace(/\/upload\//, `/upload/${txString}/`);
}

/**
 * Generate a srcSet string for responsive images.
 * widths: array of pixel widths to generate (e.g. [400, 800, 1200])
 */
export function cldSrcSet(
  url: string | null | undefined,
  widths: number[]
): string {
  if (!url || !isCloudinaryUrl(url)) return "";
  return widths.map((w) => `${cldUrl(url, { width: w })} ${w}w`).join(", ");
}
