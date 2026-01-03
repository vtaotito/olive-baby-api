-- Promote admin user to ADMIN role
UPDATE "User" 
SET role = 'ADMIN' 
WHERE email = 'adm@api.oliecare.cloud';

-- Log the promotion in audit events
INSERT INTO "AuditEvent" ("userId", "action", "targetType", "targetId", "metadata", "createdAt")
SELECT 
  id,
  'ADMIN_USER_ROLE_CHANGED',
  'user',
  id,
  '{"method": "migration", "script": "20260103_promote_admin"}'::jsonb,
  NOW()
FROM "User"
WHERE email = 'adm@api.oliecare.cloud';
