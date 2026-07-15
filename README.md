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
```

Local migration creation and verification require a reachable PostgreSQL instance,
installed directly or supplied through Docker. Neither PostgreSQL nor Docker was
available when this foundation was added, so no migration was created, executed, or
claimed as database-tested.

## Architecture

The accepted technical baseline is documented in:

- [Architecture baseline](docs/05-architecture/ARCHITECTURE_BASELINE.md)
- [Application contracts](docs/05-architecture/APPLICATION_CONTRACTS.md)
- [Data model](docs/05-architecture/DATA_MODEL.md)
- [Delivery and operations](docs/05-architecture/DELIVERY_AND_OPERATIONS.md)
- [Domain boundaries](docs/05-architecture/DOMAIN_BOUNDARIES.md)
- [Security and permissions](docs/05-architecture/SECURITY_AND_PERMISSIONS.md)
