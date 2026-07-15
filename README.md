# Pixel&Digital

Minimal full-stack application scaffold for the Pixel&Digital platform.

## Local development

Prerequisites: a current Node.js release and npm.

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

Run all repository checks with:

```sh
npm run check
npm run build
```

## Database foundation

Prisma is configured for PostgreSQL and reads `DATABASE_URL` from the server
environment. Copy `.env.example` to an ignored local `.env` file and replace its
placeholders before using database commands. The example contains no credentials.

```sh
npm run prisma:generate
npm run prisma:validate
npm run test:integration:db
```

The database integration command starts an isolated PostgreSQL-compatible PGlite
server, applies the versioned initial migration SQL, tests the Prisma Worlds repository,
and removes the temporary database. This is repository-level PostgreSQL protocol
evidence, not production parity.

Docker and a native PostgreSQL installation are still unavailable on this machine.
`prisma migrate deploy` could not connect to PGlite through Prisma's migration engine,
so deployment-engine migration verification remains open until native PostgreSQL or
Docker is available.

## Architecture

The accepted technical baseline is documented in:

- [Architecture baseline](docs/05-architecture/ARCHITECTURE_BASELINE.md)
- [Application contracts](docs/05-architecture/APPLICATION_CONTRACTS.md)
- [Data model](docs/05-architecture/DATA_MODEL.md)
- [Delivery and operations](docs/05-architecture/DELIVERY_AND_OPERATIONS.md)
- [Domain boundaries](docs/05-architecture/DOMAIN_BOUNDARIES.md)
- [Security and permissions](docs/05-architecture/SECURITY_AND_PERMISSIONS.md)
