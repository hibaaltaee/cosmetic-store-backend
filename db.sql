CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100)        NOT NULL,
  email      VARCHAR(150) UNIQUE NOT NULL,
  password   VARCHAR(255)        NOT NULL,
  role       VARCHAR(20)         NOT NULL DEFAULT 'staff'
             CHECK (role IN ('admin', 'staff')),
  is_active  BOOLEAN             NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100)        NOT NULL,
  slug        VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  image_url   TEXT,
  is_active   BOOLEAN             NOT NULL DEFAULT true,
  sort_order  INT                 NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200)   NOT NULL,
  slug          VARCHAR(220) UNIQUE NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2)       NOT NULL CHECK (price >= 0),
  compare_price NUMERIC(10,2)                CHECK (compare_price >= 0),
  stock         INT                 NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku           VARCHAR(100) UNIQUE,
  category_id   INT                 REFERENCES categories(id) ON DELETE SET NULL,
  images        TEXT[]              NOT NULL DEFAULT '{}',
  is_featured   BOOLEAN             NOT NULL DEFAULT false,
  is_active     BOOLEAN             NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  order_number   VARCHAR(20) UNIQUE NOT NULL,
  customer_name  VARCHAR(150)       NOT NULL,
  customer_phone VARCHAR(30)        NOT NULL,
  customer_email VARCHAR(150),
  address        TEXT               NOT NULL,
  city           VARCHAR(100)       NOT NULL,
  notes          TEXT,
  status         VARCHAR(30)        NOT NULL DEFAULT 'pending'
                 CHECK (status IN (
                   'pending', 'confirmed', 'processing',
                   'shipped', 'delivered', 'cancelled'
                 )),
  total_price    NUMERIC(10,2)      NOT NULL CHECK (total_price >= 0),
  payment_method VARCHAR(30)        NOT NULL DEFAULT 'cash_on_delivery',
  created_at     TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INT           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    INT                    REFERENCES products(id) ON DELETE SET NULL,
  product_name  VARCHAR(200)  NOT NULL,
  product_image TEXT,
  quantity      INT           NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price   NUMERIC(10,2) NOT NULL CHECK (total_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active   ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order    ON order_items(order_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','categories','products','orders'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
      CREATE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;