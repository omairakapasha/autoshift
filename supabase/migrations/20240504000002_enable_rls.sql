-- 1. Create Base Tables
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  since DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT UNIQUE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  color TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT NOT NULL,
  type TEXT NOT NULL,
  date DATE NOT NULL,
  next_due DATE NOT NULL,
  cost NUMERIC,
  status TEXT DEFAULT 'Completed',
  tech TEXT,
  notes TEXT,
  _last_outreach_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 3. Create Access Policies
-- Since we use the 'anon' key with a PIN gate, we allow 'anon' access.
-- If switching to full Auth, these can be restricted to 'authenticated'.

CREATE POLICY "Allow anon access to clients" ON clients FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon access to cars" ON cars FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon access to services" ON services FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon access to appointments" ON appointments FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_cars_plate ON cars(plate);
CREATE INDEX IF NOT EXISTS idx_services_next_due ON services(next_due);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
