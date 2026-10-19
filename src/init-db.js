import dotenv from "dotenv";
dotenv.config();
import { pool } from "./db.js";
const sql = `
CREATE TABLE IF NOT EXISTS admins (
 id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 last_login_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS products (
 id BIGSERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 platform TEXT NOT NULL DEFAULT 'Android', coins INTEGER NOT NULL CHECK(coins>0),
 price_paisa INTEGER NOT NULL CHECK(price_paisa>=0),
 old_price_paisa INTEGER CHECK(old_price_paisa IS NULL OR old_price_paisa>=price_paisa),
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS orders (
 id BIGSERIAL PRIMARY KEY, public_id TEXT NOT NULL UNIQUE,
 customer_name TEXT NOT NULL, phone TEXT NOT NULL, contact_handle TEXT NOT NULL,
 player_id TEXT NOT NULL, product_id BIGINT REFERENCES products(id),
 product_name_snapshot TEXT NOT NULL, unit_price_paisa INTEGER NOT NULL CHECK(unit_price_paisa>=0),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99), total_paisa INTEGER NOT NULL CHECK(total_paisa>=0),
 payment_method TEXT NOT NULL CHECK(payment_method IN ('bkash','nagad','other')),
 transaction_reference TEXT, payment_status TEXT NOT NULL DEFAULT 'unverified'
 CHECK(payment_status IN ('unverified','pending','verified','rejected')),
 order_status TEXT NOT NULL DEFAULT 'pending'
 CHECK(order_status IN ('pending','payment_review','paid','processing','delivered','cancelled','refunded')),
 customer_note TEXT, admin_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(order_status,payment_status);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders(phone);
CREATE TABLE IF NOT EXISTS admin_audit_log (
 id BIGSERIAL PRIMARY KEY, admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
 action TEXT NOT NULL, order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
 details JSONB NOT NULL DEFAULT '{}'::jsonb, ip_address INET, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS session (
 sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expire_idx ON session(expire);
`;
try { await pool.query(sql); console.log("Database tables ready."); }
finally { await pool.end(); }
