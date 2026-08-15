/**
 * PushNavigatorRegistrar
 * ======================
 * Invisible component that lives inside the React tree (inside WouterRouter
 * and AuthProvider) and registers the wouter navigate function + user role
 * with the push-navigation module.
 *
 * Must be placed inside <WouterRouter> so useLocation() works, and inside
 * <AuthProvider> so useAuth() works.  Renders nothing.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { registerPushNavigator } from "@/lib/push-navigation";

export function PushNavigatorRegistrar() {
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();

  useEffect(() => {
    registerPushNavigator(
      (to) => navigate(to),
      () => currentUser?.role ?? null,
    );
  }, [navigate, currentUser?.role]);

  return null;
}
