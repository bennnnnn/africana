-- One report per reporter → reported profile (matches app + reportUser()).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_reporter_reported_unique'
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_reporter_reported_unique UNIQUE (reporter_id, reported_id);
  END IF;
END $$;
