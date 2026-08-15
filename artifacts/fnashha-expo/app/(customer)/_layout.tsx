import React from 'react';
import { Tabs } from 'expo-router';
/**
 * Customer tab navigator — 4 routes, 5 visual slots (FAB is slot 3).
 *
 * The tab bar is rendered by PersistentTabBar at the root layout level so it
 * remains visible on Stack screens outside this group.  tabBar={() => null}
 * suppresses the duplicate per-navigator bar.
 */
export default function CustomerLayout() {
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="my-page" />
      <Tabs.Screen name="requests" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
