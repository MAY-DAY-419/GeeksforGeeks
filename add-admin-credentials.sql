-- Add new admin credentials for mitgfg@everyone
-- Password: MS!%^

-- Step 1: Generate hash in browser console:
/*
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

hashPassword('MS!%^').then(hash => {
  console.log('Your password hash is:', hash);
});
*/

-- Step 2: After getting the hash from console, run this:

-- Delete old admin if exists
DELETE FROM admins WHERE email = 'admin@gfg.com';

-- Insert new admin (without is_active column)
INSERT INTO admins (email, password_hash) 
VALUES ('mitgfg@everyone', 'YOUR_GENERATED_HASH_FROM_CONSOLE')
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash;

-- Example with a sample hash (replace with your generated hash):
-- INSERT INTO admins (email, password_hash) 
-- VALUES ('mitgfg@everyone', '9a8e8e3f8d3c4c8e0a5e5b5c1a4d2c3f8e9a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d');

