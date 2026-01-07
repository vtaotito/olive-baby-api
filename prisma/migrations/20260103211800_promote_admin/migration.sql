-- Promote admin user to ADMIN role
-- Note: Admin is already configured via app initialization
-- This migration is kept for documentation purposes
UPDATE "users" 
SET role = 'ADMIN' 
WHERE email = 'adm@api.oliecare.cloud';
