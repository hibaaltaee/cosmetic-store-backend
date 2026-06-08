# Cosmetic Store — REST API

A production-ready REST API for a cosmetic e-commerce store built with Node.js, Express, and PostgreSQL.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (raw SQL — no ORM)
- **Authentication**: JWT
- **File Upload**: Multer (local storage)
- **Password Hashing**: bcryptjs

## Features
- JWT authentication with role-based access (admin/staff)
- Full CRUD for products and categories
- Order management with cash on delivery
- Transaction-safe order creation (stock management)
- Pagination, filtering, and search
- Admin dashboard statistics
- Image upload support



## API Endpoints

### Auth
| Method | Route | Access |
|--------|-------|--------|
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| POST | `/api/auth/change-password` | Authenticated |

### Products
| Method | Route | Access |
|--------|-------|--------|
| GET | `/api/products` | Public |
| GET | `/api/products/:slug` | Public |
| GET | `/api/admin/products` | Admin |
| POST | `/api/admin/products` | Admin |
| PUT | `/api/admin/products/:id` | Admin |
| DELETE | `/api/admin/products/:id` | Admin |

### Categories
| Method | Route | Access |
|--------|-------|--------|
| GET | `/api/categories` | Public |
| GET | `/api/categories/:slug` | Public |
| GET | `/api/admin/categories` | Admin |
| POST | `/api/admin/categories` | Admin |
| PUT | `/api/admin/categories/:id` | Admin |
| DELETE | `/api/admin/categories/:id` | Admin |

### Orders
| Method | Route | Access |
|--------|-------|--------|
| POST | `/api/orders` | Public |
| GET | `/api/orders/track/:orderNumber` | Public |
| GET | `/api/admin/orders` | Admin |
| GET | `/api/admin/orders/:id` | Admin |
| PATCH | `/api/admin/orders/:id/status` | Admin |

### Stats
| Method | Route | Access |
|--------|-------|--------|
| GET | `/api/admin/stats` | Admin |

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your values
```

### 3. Create database
```bash
psql -U postgres -c "CREATE DATABASE cosmetic_store;"
psql -U postgres -d cosmetic_store -f db.sql
```

### 4. Start server
```bash
npm run dev   # development
npm start     # production
```

## Key Technical Decisions

- **Transactions for orders** — Atomic operations ensure data consistency when placing orders
- **JWT stateless auth** — Scalable authentication without server-side sessions
- **Role-based access** — Admin and staff roles with middleware protection