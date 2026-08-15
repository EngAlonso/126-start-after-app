import { eq } from "drizzle-orm";
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
import { getEligibleSeoLandingPages } from "../lib/seo-landing-pages";

class RollbackFixture extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SEO eligibility regression: ${message}`);
}

async function run() {
  // Keep every fixture mobile unique while staying within the schema's
  // 11-digit Egyptian mobile format. Slicing after appending the index would
  // truncate the index and make every row collide on users_mobile_key.
  const suffix = String(Date.now()).slice(-7);
  const fixtureMobile = (index: number) => `011${suffix}${index}`;

  await db.transaction(async (tx) => {
    const [governorate] = await tx
      .insert(governoratesTable)
      .values({
        name: `SEO Test Governorate ${suffix}`,
        nameAr: `محافظة اختبار SEO ${suffix}`,
        isActive: true,
      })
      .returning({ id: governoratesTable.id });
    const [area] = await tx
      .insert(areasTable)
      .values({
        name: `SEO Test Area ${suffix}`,
        nameAr: `منطقة اختبار SEO ${suffix}`,
        governorateId: governorate.id,
        isActive: true,
      })
      .returning({ id: areasTable.id });
    const [service] = await tx
      .insert(servicesTable)
      .values({
        name: `SEO Test Service ${suffix}`,
        nameAr: `خدمة اختبار SEO ${suffix}`,
        isActive: true,
      })
      .returning({ id: servicesTable.id });

    const fixtureUsers = await tx
      .insert(usersTable)
      .values(
        [
          ["no-relationship", "active", "approved"],
          ["pending-profile", "active", "pending"],
          ["inactive-account", "suspended", "approved"],
          ["no-service-link", "active", "approved"],
          ["no-area-link", "active", "approved"],
          ["eligible-second", "active", "approved"],
        ].map(([label, status, approvalStatus], index) => ({
          fullName: `SEO Fixture ${label} ${suffix}`,
          mobile: fixtureMobile(index),
          passwordHash: "seo-fixture-not-a-password",
          role: "technician" as const,
          status: status as "active" | "suspended",
          jobTitle: "SEO fixture",
        })),
      )
      .returning({ id: usersTable.id });

    const profiles = await tx
      .insert(technicianProfilesTable)
      .values(
        fixtureUsers.map((user, index) => ({
          userId: user.id,
          nationalId: `SEO${suffix}${index}`,
          approvalStatus: [
            "approved",
            "pending",
            "approved",
            "approved",
            "approved",
            "approved",
          ][index] as "approved" | "pending",
        })),
      )
      .returning({ id: technicianProfilesTable.id });

    async function inventoryCount() {
      const pages = await getEligibleSeoLandingPages(tx);
      return pages.filter(
        (page) => page.serviceId === service.id && page.areaId === area.id,
      );
    }

    // Case B: no technician/service/area relationship.
    assert((await inventoryCount()).length === 0, "Case B failed");
    // Case H: an existing active service with zero eligible technicians must
    // not create a page merely because the service and area are active.
    assert(
      (await inventoryCount()).length === 0,
      "Case H failed: existing service with zero technicians",
    );

    // Case C: technician exists and is linked, but profile is not approved.
    await tx.insert(technicianServicesTable).values({
      technicianId: profiles[1].id,
      serviceId: service.id,
    });
    await tx.insert(technicianAreasTable).values({
      technicianId: profiles[1].id,
      areaId: area.id,
    });
    assert((await inventoryCount()).length === 0, "Case C failed");

    // Case D: technician is approved and linked, but account is inactive.
    await tx.insert(technicianServicesTable).values({
      technicianId: profiles[2].id,
      serviceId: service.id,
    });
    await tx.insert(technicianAreasTable).values({
      technicianId: profiles[2].id,
      areaId: area.id,
    });
    assert((await inventoryCount()).length === 0, "Case D failed");

    // Case E: approved/active technician is linked to the area but not service.
    await tx.insert(technicianAreasTable).values({
      technicianId: profiles[3].id,
      areaId: area.id,
    });
    assert((await inventoryCount()).length === 0, "Case E failed");

    // Case F: approved/active technician is linked to the service but not area.
    await tx.insert(technicianServicesTable).values({
      technicianId: profiles[4].id,
      serviceId: service.id,
    });
    assert((await inventoryCount()).length === 0, "Case F failed");

    // Case A: all eligibility conditions become true.
    await tx
      .update(technicianProfilesTable)
      .set({ approvalStatus: "approved" })
      .where(eq(technicianProfilesTable.id, profiles[1].id));
    const eligiblePages = await inventoryCount();
    assert(eligiblePages.length === 1, "Case A failed");

    // Lifecycle: when the only eligible technician becomes unapproved, the
    // inventory must disappear on the very next query (no stale cache window).
    await tx
      .update(technicianProfilesTable)
      .set({ approvalStatus: "pending" })
      .where(eq(technicianProfilesTable.id, profiles[1].id));
    assert((await inventoryCount()).length === 0, "Lifecycle ineligibility failed");
    await tx
      .update(technicianProfilesTable)
      .set({ approvalStatus: "approved" })
      .where(eq(technicianProfilesTable.id, profiles[1].id));

    // Case G: a second eligible technician must not duplicate the SEO page.
    await tx.insert(technicianServicesTable).values({
      technicianId: profiles[5].id,
      serviceId: service.id,
    });
    await tx.insert(technicianAreasTable).values({
      technicianId: profiles[5].id,
      areaId: area.id,
    });
    const deduplicatedPages = await inventoryCount();
    assert(deduplicatedPages.length === 1, "Case G failed");

    console.log(
      JSON.stringify({
        cases: {
          A: "pass",
          B: "pass",
          C: "pass",
          D: "pass",
          E: "pass",
          F: "pass",
          G: "pass",
          H: "pass",
        },
        lifecycle: "pass",
        eligibleCombinations: deduplicatedPages.length,
        serviceSlug: deduplicatedPages[0].serviceSlug,
        locationSlug: deduplicatedPages[0].locationSlug,
      }),
    );

    // Never leave test users, profiles, services, or locations in the
    // development database, even when all assertions pass.
    throw new RollbackFixture("fixture assertions complete");
  }).catch((error) => {
    if (error instanceof RollbackFixture) return;
    throw error;
  });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});