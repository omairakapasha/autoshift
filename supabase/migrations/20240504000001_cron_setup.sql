-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the client-outreach function to run daily at 9:00 AM UTC
-- Note: Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> with actual values 
-- OR better yet, use a wrapper function that uses internal vault secrets.

SELECT cron.schedule(
  'daily-client-outreach',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://' || current_setting('request.headers')::json->>'host' || '/functions/v1/client-outreach',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);
