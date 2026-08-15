import type { Response } from "express";

// ── Admin clients ─────────────────────────────────────────────────────────────
const adminClients = new Set<Response>();

export function addAdminClient(res: Response): void {
  adminClients.add(res);
  res.on("close", () => adminClients.delete(res));
}

export function broadcastAdminEvent(event: string, data: Record<string, unknown>): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of adminClients) {
    // On write failure (broken pipe, TCP reset) remove immediately so we don't
    // accumulate dead entries that would never trigger the "close" event
    // (e.g. mobile connections dropped by a NAT or router without sending FIN).
    try { res.write(payload); } catch { adminClients.delete(res); }
  }
}

// ── Per-user clients (customers & technicians) ────────────────────────────────
const userClients = new Map<number, Set<Response>>();

export function addUserClient(userId: number, res: Response): void {
  if (!userClients.has(userId)) userClients.set(userId, new Set());
  const clients = userClients.get(userId)!;
  clients.add(res);
  res.on("close", () => {
    clients.delete(res);
    if (clients.size === 0) userClients.delete(userId);
  });
}

export function broadcastToUser(userId: number, event: string, data: Record<string, unknown>): void {
  const clients = userClients.get(userId);
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {
      clients.delete(res);
      if (clients.size === 0) userClients.delete(userId);
    }
  }
}

export function broadcastToUsers(userIds: number[], event: string, data: Record<string, unknown>): void {
  if (userIds.length === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const userId of userIds) {
    const clients = userClients.get(userId);
    if (!clients) continue;
    for (const res of clients) {
      try { res.write(payload); } catch {
        clients.delete(res);
        if (clients.size === 0) userClients.delete(userId);
      }
    }
  }
}

// ── Broadcast to every connected client (admins + all users) ─────────────────
// Used by System Maintenance to notify every open tab/session that a new
// frontend/service-worker version is available.
export function broadcastToAll(event: string, data: Record<string, unknown>): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of adminClients) {
    try { res.write(payload); } catch { adminClients.delete(res); }
  }
  // Iterate with entries() so we have the userId key available for cleanup
  for (const [uid, clients] of userClients.entries()) {
    for (const res of clients) {
      try { res.write(payload); } catch {
        clients.delete(res);
        if (clients.size === 0) userClients.delete(uid);
      }
    }
  }
}

// ── Connected client counts (for diagnostics) ─────────────────────────────────
export function getConnectedClientsCount(): { admins: number; users: number; uniqueUsers: number } {
  let userConnections = 0;
  for (const clients of userClients.values()) userConnections += clients.size;
  return {
    admins: adminClients.size,
    users: userConnections,
    uniqueUsers: userClients.size,
  };
}
