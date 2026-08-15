import { useEffect } from "react";
import { useLocation } from "wouter";

/** /r/:code — captures a short referral link and redirects to registration with the code pre-filled. */
export default function ReferralRedirect({ code }: { code?: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    const normalizedCode = code?.trim().toUpperCase();
    const destination = normalizedCode && /^[A-Z0-9]{8}$/.test(normalizedCode)
      ? `/register/customer?ref=${encodeURIComponent(normalizedCode)}`
      : "/register/customer";
    navigate(destination, { replace: true });
  }, [code, navigate]);
  return null;
}
