-- ============================================
-- GFG Event Management System - Database Schema
-- ============================================

-- Ensure UUID generation function is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Minimal admins table required by foreign keys and RLS checks
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 1. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Event Info
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT CHECK (event_type IN ('Workshop', 'Talk', 'Hackathon', 'Competition', 'Meetup', 'Other')),
    
    -- Date & Time
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Venue
    venue TEXT,
    
    -- Registration Settings
    requires_payment BOOLEAN DEFAULT false,
    payment_amount DECIMAL(10,2),
    allow_screenshot_upload BOOLEAN DEFAULT false,
    max_participants INTEGER,
    
    -- Visibility & Status
    is_visible BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_draft BOOLEAN DEFAULT false,
    registration_open BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by UUID REFERENCES admins(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- SEO & Display
    banner_image_url TEXT,
    event_slug TEXT UNIQUE
);

-- 2. EVENT CUSTOM FIELDS TABLE
CREATE TABLE IF NOT EXISTS event_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    
    -- Field Configuration
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT CHECK (field_type IN ('text', 'textarea', 'email', 'phone', 'number', 'checkbox', 'radio', 'dropdown', 'file')),
    
    -- Field Options (for dropdown, radio, checkbox)
    field_options JSONB, -- e.g., ["Option 1", "Option 2", "Option 3"]
    
    -- Validation
    is_required BOOLEAN DEFAULT false,
    placeholder TEXT,
    validation_rules JSONB, -- e.g., {"min": 10, "max": 100}
    
    -- Display Order
    field_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. EVENT REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    
    -- Default Fields
    full_name TEXT NOT NULL,
    prn TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    
    -- Payment Info
    payment_screenshot_url TEXT,
    payment_verified BOOLEAN DEFAULT false,
    
    -- Custom Fields Responses
    custom_fields_data JSONB, -- Store all custom field answers as JSON
    
    -- Status
    registration_status TEXT DEFAULT 'pending' CHECK (registration_status IN ('pending', 'approved', 'rejected', 'cancelled')),
    
    -- Metadata
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_by UUID REFERENCES admins(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Prevent duplicate registrations
    UNIQUE(event_id, email)
);

-- 4. EVENT ANALYTICS TABLE (Optional - for tracking)
CREATE TABLE IF NOT EXISTS event_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    
    -- Metrics
    total_views INTEGER DEFAULT 0,
    total_registrations INTEGER DEFAULT 0,
    total_approved INTEGER DEFAULT 0,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_events_status ON events(is_visible, is_draft, registration_open);
CREATE INDEX idx_events_featured ON events(is_featured, event_date);
CREATE INDEX idx_events_date ON events(event_date DESC);
CREATE INDEX idx_events_slug ON events(event_slug);

CREATE INDEX idx_custom_fields_event ON event_custom_fields(event_id, field_order);

CREATE INDEX idx_registrations_event ON event_registrations(event_id, registration_status);
CREATE INDEX idx_registrations_email ON event_registrations(email);
CREATE INDEX idx_registrations_date ON event_registrations(registered_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_analytics ENABLE ROW LEVEL SECURITY;

-- EVENTS POLICIES
-- Public can view visible, non-draft events
CREATE POLICY "Public can view published events"
    ON events FOR SELECT
    USING (is_visible = true AND is_draft = false);

-- Admins can do everything
CREATE POLICY "Admins can manage all events"
    ON events FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.id::text = (current_setting('request.jwt.claims', true))::json->>'sub'
        )
    );

-- CUSTOM FIELDS POLICIES
-- Public can view custom fields for visible events
CREATE POLICY "Public can view event custom fields"
    ON event_custom_fields FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events 
            WHERE events.id = event_custom_fields.event_id 
            AND events.is_visible = true 
            AND events.is_draft = false
        )
    );

-- Admins can manage custom fields
CREATE POLICY "Admins can manage custom fields"
    ON event_custom_fields FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.id::text = (current_setting('request.jwt.claims', true))::json->>'sub'
        )
    );

-- REGISTRATIONS POLICIES
-- Anyone can register (insert)
CREATE POLICY "Anyone can register for events"
    ON event_registrations FOR INSERT
    WITH CHECK (true);

-- Users can view their own registrations
CREATE POLICY "Users can view own registrations"
    ON event_registrations FOR SELECT
    USING (email = (current_setting('request.jwt.claims', true))::json->>'email');

-- Admins can view/manage all registrations
CREATE POLICY "Admins can manage all registrations"
    ON event_registrations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.id::text = (current_setting('request.jwt.claims', true))::json->>'sub'
        )
    );

-- ANALYTICS POLICIES
-- Admins only
CREATE POLICY "Admins can view analytics"
    ON event_analytics FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE admins.id::text = (current_setting('request.jwt.claims', true))::json->>'sub'
        )
    );

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp for events
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at_trigger
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_events_updated_at();

-- Auto-generate event slug from title
CREATE OR REPLACE FUNCTION generate_event_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    uuid_part TEXT;
BEGIN
    IF NEW.id IS NULL THEN
        NEW.id := gen_random_uuid();
    END IF;

    IF NEW.event_slug IS NULL OR NEW.event_slug = '' THEN
        base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
        uuid_part := substr(NEW.id::text, 1, 8);
        NEW.event_slug := base_slug || '-' || uuid_part;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_event_slug_trigger
    BEFORE INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION generate_event_slug();

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View for admin dashboard - event statistics
CREATE OR REPLACE VIEW admin_event_stats AS
SELECT 
    e.id as event_id,
    e.title,
    e.event_date,
    e.is_visible,
    e.is_featured,
    e.is_draft,
    e.registration_open,
    COUNT(DISTINCT er.id) as total_registrations,
    COUNT(DISTINCT CASE WHEN er.registration_status = 'approved' THEN er.id END) as approved_registrations,
    COUNT(DISTINCT CASE WHEN er.registration_status = 'pending' THEN er.id END) as pending_registrations
FROM events e
LEFT JOIN event_registrations er ON e.id = er.event_id
GROUP BY e.id, e.title, e.event_date, e.is_visible, e.is_featured, e.is_draft, e.registration_open
ORDER BY e.event_date DESC;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Sample Event
INSERT INTO events (title, description, event_type, event_date, venue, requires_payment, payment_amount, is_visible, is_featured, is_draft)
VALUES 
    ('Web Development Workshop', 'Learn modern web development with React and Next.js', 'Workshop', 
     NOW() + INTERVAL '7 days', 'Computer Lab A', true, 100.00, true, true, false);

COMMENT ON TABLE events IS 'Stores all GFG events with detailed configuration';
COMMENT ON TABLE event_custom_fields IS 'Custom registration form fields for each event';
COMMENT ON TABLE event_registrations IS 'User registrations for events with custom field responses';
