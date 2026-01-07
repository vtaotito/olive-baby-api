-- Promote admin user to ADMIN role
UPDATE "users" 
SET role = 'ADMIN' 
WHERE email = 'adm@api.oliecare.cloud';

-- Log the promotion in audit events
INSERT INTO "audit_events" ("user_id", "action", "target_type", "target_id", "metadata", "created_at")
SELECT 
  id,
  'ADMIN_USER_ROLE_CHANGED',
  'user',
  id,
  '{"method": "migration", "script": "20260103_promote_admin"}'::jsonb,
  NOW()
FROM "users"
WHERE email = 'adm@api.oliecare.cloud';
