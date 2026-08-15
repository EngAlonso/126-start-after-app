import { db } from "@workspace/db";
import { getQualifiedTechnicianRelationships } from "./technician-matching";

export type SeoLandingPage = {
  serviceId: number;
  serviceName: string;
  serviceNameAr: string;
  serviceIcon: string | null;
  serviceImage: string | null;
  areaId: number;
  areaName: string;
  areaNameAr: string;
  governorateId: number;
  governorateName: string;
  governorateNameAr: string;
  serviceSlug: string;
  locationSlug: string;
};

type SeoDbExecutor = Pick<typeof db, "select">;

/**
 * Keep public slugs deterministic without adding a second public-name field to
 * the existing reference tables. Unicode is intentionally preserved so Arabic
 * names remain readable when an English name is unavailable.
 */
export function toPublicSlug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ");

  return normalized
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function addCollisionSuffix(base: string, id: number, ids: Set<number>): string {
  return ids.size > 1 ? `${base || "location"}-${id}` : base || `location-${id}`;
}

async function queryEligibleRows(database: SeoDbExecutor = db) {
  // Use the exact core matcher used by request notifications. SEO additionally
  // requires active service, area, and governorate reference rows. Starting
  // from technician relationships avoids a service × area Cartesian product.
  const rows = await getQualifiedTechnicianRelationships(database, {
    requireActiveReferences: true,
  });
  return rows.sort(
    (left, right) =>
      left.serviceNameAr.localeCompare(right.serviceNameAr) ||
      left.governorateNameAr.localeCompare(right.governorateNameAr) ||
      left.areaNameAr.localeCompare(right.areaNameAr),
  );
}

export async function getEligibleSeoLandingPages(
  database: SeoDbExecutor = db,
): Promise<SeoLandingPage[]> {
  const rows = await queryEligibleRows(database);
  const uniqueRows = Array.from(
    new Map(rows.map((row) => [`${row.serviceId}:${row.areaId}`, row])).values(),
  );
  const serviceIdsBySlug = new Map<string, Set<number>>();
  const areaIdsBySlug = new Map<string, Set<number>>();

  for (const row of uniqueRows) {
    const serviceSlug = toPublicSlug(row.serviceName) || toPublicSlug(row.serviceNameAr);
    const areaSlug = toPublicSlug(row.areaName) || toPublicSlug(row.areaNameAr);
    if (!serviceIdsBySlug.has(serviceSlug)) serviceIdsBySlug.set(serviceSlug, new Set());
    if (!areaIdsBySlug.has(areaSlug)) areaIdsBySlug.set(areaSlug, new Set());
    serviceIdsBySlug.get(serviceSlug)!.add(row.serviceId);
    areaIdsBySlug.get(areaSlug)!.add(row.areaId);
  }

  return uniqueRows.map((row) => {
    const serviceBase = toPublicSlug(row.serviceName) || toPublicSlug(row.serviceNameAr);
    const areaBase = toPublicSlug(row.areaName) || toPublicSlug(row.areaNameAr);
    return {
      ...row,
      serviceSlug: addCollisionSuffix(serviceBase, row.serviceId, serviceIdsBySlug.get(serviceBase)!),
      locationSlug: addCollisionSuffix(areaBase, row.areaId, areaIdsBySlug.get(areaBase)!),
    };
  });
}

export async function findEligibleSeoLandingPage(
  serviceSlug: string,
  locationSlug: string,
  database: SeoDbExecutor = db,
): Promise<SeoLandingPage | null> {
  const pages = await getEligibleSeoLandingPages(database);
  return (
    pages.find(
      (page) =>
        page.serviceSlug === serviceSlug && page.locationSlug === locationSlug,
    ) ?? null
  );
}