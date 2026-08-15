/**
 * Renders the role-appropriate tab bar as an absolutely-positioned overlay
 * on every authenticated app screen.
 *
 * Mounted once at the root layout level (inside AuthGate, alongside the Stack
 * navigator) so it persists through all Stack navigation — tab screens AND
 * detail screens (requests/[id], messages, notifications, …) alike.
 *
 * Hides itself for:
 *   • Unauthenticated users (covers login / register / guest home)
 *   • Admin / super_admin (no mobile tab bar)
 *   • Explicit opt-out paths (intro slideshow)
 */
import React from 'react';
import { usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { CustomerTabBar } from './CustomerTabBar';
import { TechnicianTabBar } from './TechnicianTabBar';

const NO_TAB_PATHS = new Set([
  '/intro',
  '/login',
  '/register',
  '/register-select',
  '/register-tech',
]);

export function PersistentTabBar() {
  const { user } = useAuth();
  const pathname  = usePathname();

  if (!user) return null;
  if (NO_TAB_PATHS.has(pathname)) return null;
  if (user.role !== 'customer' && user.role !== 'technician') return null;

  if (user.role === 'customer') return <CustomerTabBar />;
  return <TechnicianTabBar />;
}
