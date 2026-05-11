-- 1. Create Outreach Logs table to track AI messages
CREATE TABLE IF NOT EXISTS outreach_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'sent', -- 'sent', 'failed'
  generated_message TEXT,
  metadata JSONB, -- To store API responses from Gemini/Twilio
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add tracking field to services to prevent duplicate outreach
ALTER TABLE services ADD COLUMN IF NOT EXISTS _last_outreach_at TIMESTAMPTZ;

-- 3. Add index for faster searching of due dates
CREATE INDEX IF NOT EXISTS idx_services_next_due ON services(next_due);

-- 4. Enable RLS (Recommended, though owner-only for now)
ALTER TABLE outreach_logs ENABLE ROW LEVEL SECURITY;
