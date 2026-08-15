import React from 'react';
import { Tabs } from 'expo-router';
/**
 * Technician tab navigator — 4 routes.
 *
 * Route order: index  my-page  requests  account
 * wallet is registered with href:null so the file can still be pushed to
 * directly but it does not appear in the bar.
 *
 * The tab bar is rendered by PersistentTabBar at the root layout level so it
 * stays visible on Stack screens outside this group.  tabBar={() => null}
 * suppresses the duplicate per-navigator bar.
 */
export default function TechnicianLayout() {
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="my-page" />
      <Tabs.Screen name="requests" />
      <Tabs.Screen name="account" />
      <Tabs.Screen name="wallet" options={{ href: null }} />
    </Tabs>
  );
}
