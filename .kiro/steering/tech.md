# Tech Stack

## Frontend

- **React 18** with TypeScript in strict mode
- **Vite** for build tooling and dev server (port 5173)
- **React Router v7** for client-side routing
- **TanStack Query v5** for server state management
- **Zustand** for client state management
- **Tailwind CSS** with custom theme system
- **shadcn/ui** component library (Radix UI primitives)
- **Framer Motion** for animations
- **Zod** for schema validation
- **React Hook Form** with resolvers for form management

## Backend

- **Node.js 20+** with Express.js
- **TypeScript** with ESM modules (`"type": "module"`)
- **PostgreSQL 12+** with versioned migrations
- **JWT** for authentication
- **WebSocket (ws)** for SSH bridge
- **ssh2** for SSH terminal connections
- **Helmet** for security headers
- **express-rate-limit** with tiered limits
- **Nodemailer** for email (SMTP2GO)

## Integrations

- **PayPal REST SDK** for payments
- **Linode/Akamai API** for VPS provisioning
- **PostgreSQL LISTEN/NOTIFY** for real-time events
- **Server-Sent Events (SSE)** for notifications

## Development Tools

- **ESLint** with TypeScript and React plugins
- **Vitest** for unit testing
- **React Testing Library** for component tests
- **Supertest** for API integration tests
- **Nodemon** for backend auto-restart
- **Concurrently** for running multiple dev servers
- **PM2** for production process management

## Common Commands

### Development
```bash
npm run dev              # Start both frontend (5173) and backend (3001)
npm run client:dev       # Frontend only
npm run server:dev       # Backend only
npm run kill-ports       # Free ports 3001 and 5173
```

### Building & Testing
```bash
npm run build            # TypeScript check + Vite production build
npm run test             # Run Vitest test suite once
npm run test:watch       # Run tests in watch mode
npm run lint             # ESLint validation
npm run check            # TypeScript type checking (no emit)
npm run preview          # Preview production build
```

### Database
```bash
node scripts/run-migration.js                    # Apply pending migrations
node scripts/apply-single-migration.js <file>    # Apply specific migration
node scripts/reset-database.js --confirm         # Reset database
npm run db:fresh                                 # Reset + migrate
```

### Production
```bash
npm run start            # Production server (Express + Vite preview)
npm run pm2:start        # Start with PM2
npm run pm2:reload       # Reload PM2 processes
npm run pm2:stop         # Stop PM2 processes
```

### Utilities
```bash
node scripts/generate-ssh-secret.js              # Generate SSH_CRED_SECRET
node scripts/create-test-admin.js                # Create admin user
node scripts/promote-to-admin.js --email <email> # Promote user to admin
node scripts/test-connection.js                  # Test DB connection
node scripts/test-smtp.js                        # Test email config
```

## Configuration

- Environment variables in `.env` (copy from `.env.example`)
- TypeScript path alias: `@/*` maps to `./src/*`
- API proxy in dev: `/api/*` → `http://localhost:3001`
- Trust proxy enabled for rate limiting behind reverse proxies
- CORS configured for dev origins (5173, 5174, 3000) and production domains
