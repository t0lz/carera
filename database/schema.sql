CREATE TABLE IF NOT EXISTS roles (
  role_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO roles (name)
VALUES ('user'), ('manager'), ('admin')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  password_hash VARCHAR(255),
  role_id INT NOT NULL REFERENCES roles(role_id),
  firstname VARCHAR(100),
  lastname VARCHAR(100),
  phone VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS car_makes (
  car_make_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS car_models (
  car_model_id SERIAL PRIMARY KEY,
  car_make_id INT NOT NULL REFERENCES car_makes(car_make_id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  UNIQUE (car_make_id, name)
);

CREATE TABLE IF NOT EXISTS body_types (
  body_type_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id SERIAL PRIMARY KEY,
  car_model_id INT NOT NULL REFERENCES car_models(car_model_id),
  body_type_id INT NOT NULL REFERENCES body_types(body_type_id),
  car_make_id INT NOT NULL REFERENCES car_makes(car_make_id),
  year INT,
  vin VARCHAR(50),
  transmission VARCHAR(100),
  fuel_type VARCHAR(100),
  drive_type VARCHAR(100),
  color VARCHAR(100),
  engine_volume_l NUMERIC,
  power_hp INT,
  torque_nm INT,
  mileage_km INT
);

CREATE TABLE IF NOT EXISTS ads (
  ad_id SERIAL PRIMARY KEY,
  seller_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  vehicle_id INT NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL CHECK (price > 0),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT
);

ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ads_status_check'
  ) THEN
    ALTER TABLE ads
      ADD CONSTRAINT ads_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ad_photos (
  ad_photo_id SERIAL PRIMARY KEY,
  ad_id INT NOT NULL REFERENCES ads(ad_id) ON DELETE CASCADE,
  url VARCHAR(1000) NOT NULL
);

CREATE TABLE IF NOT EXISTS import_orders (
  import_order_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  car_make VARCHAR(100) NOT NULL,
  car_model VARCHAR(100) NOT NULL,
  price_rub NUMERIC NOT NULL CHECK (price_rub > 0),
  delivery_rub NUMERIC DEFAULT 0 CHECK (delivery_rub >= 0),
  engine_volume_cm3 INT NOT NULL CHECK (engine_volume_cm3 > 0),
  power_hp INT NOT NULL CHECK (power_hp > 0),
  age_years INT NOT NULL CHECK (age_years >= 0),
  eur_rate NUMERIC NOT NULL CHECK (eur_rate > 0),
  customer_type VARCHAR(30) NOT NULL CHECK (customer_type IN ('individual', 'company')),
  status VARCHAR(30) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_work', 'calculated', 'approved', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customs_calculations (
  calculation_id SERIAL PRIMARY KEY,
  import_order_id INT NOT NULL REFERENCES import_orders(import_order_id) ON DELETE CASCADE,
  customs_fee NUMERIC NOT NULL,
  duty NUMERIC NOT NULL,
  excise NUMERIC NOT NULL,
  vat NUMERIC NOT NULL,
  utilization_fee NUMERIC NOT NULL,
  payments_total NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ads_seller_id ON ads(seller_id);
CREATE INDEX IF NOT EXISTS idx_ads_vehicle_id ON ads(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_import_orders_user_id ON import_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_import_orders_status ON import_orders(status);

-- Moderation migration for existing databases
INSERT INTO roles (name)
VALUES ('manager')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE ads
SET status = COALESCE(status, 'approved')
WHERE status IS NULL;

ALTER TABLE ads
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE ads
  DROP CONSTRAINT IF EXISTS ads_status_check;

ALTER TABLE ads
  ADD CONSTRAINT ads_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));
