---
name: Fnashha loyalty Phase 9 campaigns
description: Campaign distribution execution correctness — idempotency ordering and manual targeting requirements.
---

Campaign execution (`POST /loyalty/admin/campaigns/:id/execute`) must insert the
`campaign_distributions` row (unique on campaign_id+wallet_id) FIRST and only credit
the wallet/write the coin transaction if that insert actually returned a row.

**Why:** the original implementation credited the wallet before attempting the
distribution insert, so two concurrent executions of the same campaign both
credited coins even though the unique constraint blocked the duplicate distribution
row — a real idempotency bug caught during Phase 9 review.

**How to apply:** any future "reward/credit on first successful claim" flow in this
codebase should follow the same pattern: claim the idempotency row first (insert
... onConflictDoNothing().returning()), then branch on whether a row came back.

Manual-target campaigns (`campaigns.target = 'manual'`) require
`segmentFilter.userIds` (array of user ids) to be set via PUT before execution;
otherwise execute returns 400. Without this guard, manual campaigns silently
rewarded ALL customers, ignoring the target field entirely.
