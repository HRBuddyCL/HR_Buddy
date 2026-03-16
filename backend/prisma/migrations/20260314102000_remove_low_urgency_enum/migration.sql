-- Remove LOW urgency level and normalize existing LOW data to NORMAL.
ALTER TYPE "Urgency" RENAME TO "Urgency_old";

CREATE TYPE "Urgency" AS ENUM ('NORMAL', 'HIGH', 'CRITICAL');

ALTER TABLE "requests"
  ALTER COLUMN "urgency" TYPE "Urgency"
  USING (
    CASE
      WHEN "urgency"::text = 'LOW' THEN 'NORMAL'
      ELSE "urgency"::text
    END
  )::"Urgency";

ALTER TABLE "sla_policies"
  ALTER COLUMN "urgency" TYPE "Urgency"
  USING (
    CASE
      WHEN "urgency"::text = 'LOW' THEN 'NORMAL'
      ELSE "urgency"::text
    END
  )::"Urgency";

DROP TYPE "Urgency_old";
