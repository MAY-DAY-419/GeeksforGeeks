// Replace the placeholders below with your actual Supabase project values.
// You can find them in the Supabase dashboard under Project Settings -> API.
// Exposing the anon key in client-side apps is safe and intended.

// BEGIN CONFIG
var SUPABASE_URL = 'https://nljubonibhxsgazsrvkd.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sanVib25pYmh4c2dhenNydmtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxODM0ODksImV4cCI6MjA3Nzc1OTQ4OX0.fG5nHzN4t_giDy0qu8R3gEdHlCtN7fknM3vg3SuVJjk';
// END CONFIG

if (!window.supabase) {
    console.error('Supabase JS not loaded. Ensure @supabase/supabase-js@2 script is included before this file.');
}

// Initialize a global Supabase client
var supabaseClient = (function() {
    try {
        var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false }
        });
        return client;
    } catch (e) {
        console.error('Failed to initialize Supabase client:', e);
        return null;
    }
})();

// Expose on window for other scripts
window.supabaseClient = supabaseClient;

