---
name: Campaign datetime interpretation
description: Admin registration-range campaign dates use Egypt local time and inclusive boundaries.
---

Registration-range campaign dates entered by administrators represent Africa/Cairo local time, must be converted explicitly before persistence, and are evaluated inclusively against customer registration timestamps.

**Why:** Browser `datetime-local` values have no timezone, while the API process/database may run in UTC; implicit parsing can shift eligibility windows.

**How to apply:** Keep this rule limited to registration-range campaign dates so existing campaign target behavior remains unchanged.