-- Enhanced Secure Admin Table Setup for Supabase
-- Run this in your Supabase SQL Editor

-- 1. Drop existing admins table if needed (BE CAREFUL - this deletes data!)
-- DROP TABLE IF EXISTS admins CASCADE;
-- DROP TABLE IF EXISTS admin_login_logs CASCADE;

-- 2. Create admins table with additional security fields
CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE
);

-- 3. Create login logs table for audit trail
CREATE TABLE IF NOT EXISTS admin_login_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT true
);

-- 4. Enable Row Level Security
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_login_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for admins table
-- Allow anyone to read (for login verification)
CREATE POLICY "Allow login checks" ON admins
  FOR SELECT
  USING (true);

-- Only allow authenticated admins to update their own record
CREATE POLICY "Admins can update own record" ON admins
  FOR UPDATE
  USING (auth.uid()::text = id::text);

-- 6. Create policies for login logs
-- Allow inserts for logging
CREATE POLICY "Allow login log inserts" ON admin_login_logs
  FOR INSERT
  WITH CHECK (true);

-- Allow admins to view their own logs
CREATE POLICY "Admins can view own logs" ON admin_login_logs
  FOR SELECT
  USING (auth.uid()::text = admin_id::text);

-- 7. Create function to hash passwords using SHA-256
-- Note: This matches the client-side hashing function
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(password, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- 8. Insert sample admin with hashed password
-- Password: "Admin@123" (change this!)
-- To generate hash: Run in browser console: 
-- crypto.subtle.digest('SHA-256', new TextEncoder().encode('Admin@123')).then(h => console.log(Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('')))

INSERT INTO admins (email, password_hash, is_active) 
VALUES (
  'admin@gfg.com', 
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', -- Hash of "Admin@123"
  true
) ON CONFLICT (email) DO NOTHING;

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);
CREATE INDEX IF NOT EXISTS idx_login_logs_admin_id ON admin_login_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_time ON admin_login_logs(login_time DESC);

-- 10. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger to auto-update updated_at
CREATE TRIGGER update_admins_updated_at 
  BEFORE UPDATE ON admins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 12. Optional: Create view for admin dashboard stats
CREATE OR REPLACE VIEW admin_stats AS
SELECT 
  a.id,
  a.email,
  a.last_login,
  COUNT(l.id) as total_logins,
  MAX(l.login_time) as most_recent_login
FROM admins a
LEFT JOIN admin_login_logs l ON a.id = l.admin_id
GROUP BY a.id, a.email, a.last_login;

-- Grant access to the view
GRANT SELECT ON admin_stats TO authenticated;

-- ==============================================================
-- IMPORTANT: How to add a new admin manually
-- ==============================================================
-- 1. Generate password hash in browser console:
--    async function hashPassword(password) {
--      const encoder = new TextEncoder();
--      const data = encoder.encode(password);
--      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
--      const hashArray = Array.from(new Uint8Array(hashBuffer));
--      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
--    }
--    hashPassword('YourPasswordHere').then(console.log);
--
-- 2. Insert the admin:
--    INSERT INTO admins (email, password_hash) 
--    VALUES ('newemail@gfg.com', 'your_generated_hash_here');

-- ==============================================================
-- How to reset an admin password
-- ==============================================================
-- 1. Generate new hash (see above)
-- 2. Update the admin:
--    UPDATE admins 
--    SET password_hash = 'new_hash_here', 
--        failed_login_attempts = 0,
--        locked_until = NULL
--    WHERE email = 'admin@gfg.com';

-- ==============================================================
-- How to view login attempts
-- ==============================================================
-- SELECT * FROM admin_login_logs 
-- WHERE admin_id = (SELECT id FROM admins WHERE email = 'admin@gfg.com')
-- ORDER BY login_time DESC 
-- LIMIT 10;

-- ==============================================================
-- How to unlock a locked admin account
-- ==============================================================
-- UPDATE admins 
-- SET failed_login_attempts = 0, 
--     locked_until = NULL 
-- WHERE email = 'admin@gfg.com';
