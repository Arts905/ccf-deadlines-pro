-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create conferences table
CREATE TABLE IF NOT EXISTS conferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  sub VARCHAR(10), -- DS, NW, SC, SE, DB, CT, CG, AI, HI, MX
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ranks table (CCF, CORE, THCPL rankings)
CREATE TABLE IF NOT EXISTS ranks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conference_id UUID REFERENCES conferences(id) ON DELETE CASCADE,
  ccf VARCHAR(1), -- A, B, C, or NULL
  core VARCHAR(10),
  thcpl VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conference_id)
);

-- Create conference instances table (specific year/edition)
CREATE TABLE IF NOT EXISTS conference_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conference_id UUID REFERENCES conferences(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  date VARCHAR(200),
  place VARCHAR(500),
  timezone VARCHAR(50) DEFAULT 'UTC',
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conference_id, year)
);

-- Create timeline items table (deadlines)
CREATE TABLE IF NOT EXISTS timeline_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID REFERENCES conference_instances(id) ON DELETE CASCADE,
  deadline VARCHAR(100),
  abstract_deadline VARCHAR(100),
  comment VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conferences_sub ON conferences(sub);
CREATE INDEX IF NOT EXISTS idx_conferences_title ON conferences(title);
CREATE INDEX IF NOT EXISTS idx_conference_instances_year ON conference_instances(year);
CREATE INDEX IF NOT EXISTS idx_timeline_items_instance_id ON timeline_items(instance_id);

-- Enable Row Level Security (optional, can be disabled for public access)
ALTER TABLE conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conference_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_items ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Enable read access for all users" ON conferences
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON ranks
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON conference_instances
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON timeline_items
  FOR SELECT USING (true);

-- Create policies for service role to insert/update (you can disable this if not needed)
CREATE POLICY "Enable insert for service role" ON conferences
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for service role" ON conferences
  FOR UPDATE USING (true);

CREATE POLICY "Enable insert for service role" ON ranks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for service role" ON ranks
  FOR UPDATE USING (true);

CREATE POLICY "Enable insert for service role" ON conference_instances
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for service role" ON conference_instances
  FOR UPDATE USING (true);

CREATE POLICY "Enable insert for service role" ON timeline_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for service role" ON timeline_items
  FOR UPDATE USING (true);
