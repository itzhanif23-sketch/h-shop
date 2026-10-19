# H Shop Full-Stack Starter

Includes a mobile-friendly storefront, checkout and order tracking UI, admin login/dashboard, Express API, and PostgreSQL schema for Android eFootball coin orders with manual delivery.

## Important
- This is a starter project, not production-certified or deployed.
- The system intentionally does not collect Konami passwords, account passwords, OTPs, or payment PINs.
- Admin Dashboard is at `/admin.html`; storefront is `/`.
- Real admin support links are empty placeholders in `public/index.html`. Configure only your real official support links before launch.
- Demo product prices are seeded from the requested example and must be reviewed before taking orders.
- Payment is never automatically verified. Admin must independently verify payment before advancing paid/processing/delivered states.

## Requirements
Node.js 20+, npm, Docker Desktop (or PostgreSQL 16+).

## Setup
1. Copy `.env.example` to `.env`.
2. Set `SESSION_SECRET` to a random secret at least 32 characters long. Set a unique `ADMIN_PASSWORD` of at least 14 characters.
3. Set `POSTGRES_PASSWORD` in your terminal environment, then run `docker compose up -d db`. Make sure the password in `DATABASE_URL` matches.
4. Run `npm install`.
5. Run `npm run db:init`.
6. Run `npm run db:seed`.
7. Run `npm run dev`.
8. Open `http://localhost:3000` for the store and `http://localhost:3000/admin.html` for admin.
9. Health check: `http://localhost:3000/api/health`.

## Main API
- `GET /api/products`
- `POST /api/orders`
- `GET /api/orders/:publicId?phone=...`
- `POST /api/admin/login`
- `GET /api/admin/me`
- `POST /api/admin/logout`
- `GET /api/admin/orders?page=1&status=pending`
- `PATCH /api/admin/orders/:publicId`

## Workflow
Customer creates an order → admin reviews payment reference → admin independently verifies payment → marks Paid → manually processes the top-up → marks Delivered.

## Production checklist
- Deploy on HTTPS with `NODE_ENV=production`, `COOKIE_SECURE=true`, exact `APP_ORIGIN=https://your-domain`.
- Use managed PostgreSQL with private network, encrypted backups, restore tests, monitoring, and alerting.
- Add MFA, secure admin recovery, retention/deletion process, and professional security review before handling customer data.
- Review Konami/eFootball terms and payment provider rules.
