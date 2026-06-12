-- One report per reporter → reported profile. Dedupe historical rows, then enforce.
DELETE FROM public.reports r
WHERE r.id NOT IN (
  SELECT DISTINCT ON (reporter_id, reported_id) id
  FROM public.reports
  ORDER BY reporter_id, reported_id, created_at ASC, id ASC
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'reports'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) LIKE '%(reporter_id, reported_id)%'
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_reporter_reported_unique UNIQUE (reporter_id, reported_id);
  END IF;
END $$;
