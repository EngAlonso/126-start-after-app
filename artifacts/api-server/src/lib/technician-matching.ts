import { and, eq } from "drizzle-orm";
import {
  areasTable,
  db,
  governoratesTable,
  servicesTable,
  technicianAreasTable,
  technicianProfilesTable,
  technicianServicesTable,
  usersTable,
} from "@workspace/db";

type MatchingDbExecutor = Pick<typeof db, "select">;

export type QualifiedTechnicianRelationship = {
  profileId: number;
  userId: number;
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
};

/**
 * The core technician eligibility query used by the real request flow.
 *
 * A technician qualifies only when the same profile is linked to both the
 * requested service and area, the profile is approved, and its user account
 * is active. SEO can additionally require active reference rows without
 * changing this core matching definition.
 */
export async function getQualifiedTechnicianRelationships(
  database: MatchingDbExecutor = db,
  options: {
    serviceId?: number;
    areaId?: number;
    requireActiveReferences?: boolean;
  } = {},
): Promise<QualifiedTechnicianRelationship[]> {
  const requireActiveReferences = options.requireActiveReferences ?? false;

  return database
    .select({
      profileId: technicianProfilesTable.id,
      userId: usersTable.id,
      serviceId: servicesTable.id,
      serviceName: servicesTable.name,
      serviceNameAr: servicesTable.nameAr,
      serviceIcon: servicesTable.icon,
      serviceImage: servicesTable.image,
      areaId: areasTable.id,
      areaName: areasTable.name,
      areaNameAr: areasTable.nameAr,
      governorateId: governoratesTable.id,
      governorateName: governoratesTable.name,
      governorateNameAr: governoratesTable.nameAr,
    })
    .from(technicianServicesTable)
    .innerJoin(
      technicianProfilesTable,
      and(
        eq(technicianProfilesTable.id, technicianServicesTable.technicianId),
        eq(technicianProfilesTable.approvalStatus, "approved"),
      ),
    )
    .innerJoin(
      usersTable,
      and(
        eq(usersTable.id, technicianProfilesTable.userId),
        eq(usersTable.status, "active"),
      ),
    )
    .innerJoin(
      technicianAreasTable,
      and(
        eq(technicianAreasTable.technicianId, technicianProfilesTable.id),
        options.areaId === undefined
          ? undefined
          : eq(technicianAreasTable.areaId, options.areaId),
      ),
    )
    .innerJoin(servicesTable, eq(servicesTable.id, technicianServicesTable.serviceId))
    .innerJoin(areasTable, eq(areasTable.id, technicianAreasTable.areaId))
    .innerJoin(
      governoratesTable,
      eq(governoratesTable.id, areasTable.governorateId),
    )
    .where(
      and(
        options.serviceId === undefined
          ? undefined
          : eq(technicianServicesTable.serviceId, options.serviceId),
        requireActiveReferences ? eq(servicesTable.isActive, true) : undefined,
        requireActiveReferences ? eq(areasTable.isActive, true) : undefined,
        requireActiveReferences
          ? eq(governoratesTable.isActive, true)
          : undefined,
      ),
    ) as Promise<QualifiedTechnicianRelationship[]>;
}

/**
 * Return the user IDs that the request flow should notify for a service/area.
 * Set semantics match the existing request matcher even if duplicate
 * relationship rows exist.
 */
export async function getQualifiedTechnicianUserIds(
  serviceId: number,
  areaId: number,
  database: MatchingDbExecutor = db,
): Promise<number[]> {
  const relationships = await getQualifiedTechnicianRelationships(database, {
    serviceId,
    areaId,
  });
  return Array.from(new Set(relationships.map((relationship) => relationship.userId)));
}