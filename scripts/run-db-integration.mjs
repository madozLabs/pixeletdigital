import { spawn } from "node:child_process";
import { createConnection, createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "prisma", "migrations");
const serverScript = path.join(
  root,
  "node_modules",
  "@electric-sql",
  "pglite-socket",
  "dist",
  "scripts",
  "server.js",
);
const temporaryRoot = await mkdtemp(
  path.join(tmpdir(), "pixeldigital-pglite-"),
);
const port = await reservePort();
const connectionString = `postgresql://postgres@127.0.0.1:${port}/postgres`;
const server = spawn(
  process.execPath,
  [
    serverScript,
    `--db=${path.join(temporaryRoot, "db")}`,
    `--port=${port}`,
    "--max-connections=10",
  ],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForPort(port, server);
  await applyMigration(connectionString);
  await runIntegrationTests(connectionString);
} catch (error) {
  console.error(error);
  console.error(serverOutput.slice(-4000));
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  await Promise.race([onceClosed(server), delay(3000)]);
  await rm(temporaryRoot, { recursive: true, force: true });
}
async function applyMigration(connectionString) {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const migrationFiles = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(migrationsDirectory, entry.name, "migration.sql"))
    .sort();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const migrationFile of migrationFiles) {
      const sql = await readFile(migrationFile, "utf8");
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}

async function runIntegrationTests(connectionString) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli)
    throw new Error("npm_execpath is required to run integration tests.");
  const child = spawn(
    process.execPath,
    [npmCli, "run", "test:integration:db:raw"],
    {
      cwd: root,
      env: { ...process.env, TEST_DATABASE_URL: connectionString },
      stdio: "inherit",
    },
  );
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (exitCode !== 0) {
    throw new Error(`Database integration tests exited with code ${exitCode}.`);
  }
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => server.close(resolve));
  if (!port) throw new Error("Unable to reserve a local database port.");
  return port;
}

async function waitForPort(port, child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`PGlite server exited with code ${child.exitCode}.`);
    }
    try {
      await tryConnect(port);
      return;
    } catch {
      await delay(150);
    }
  }
  throw new Error("Timed out waiting for the local PostgreSQL test server.");
}

function tryConnect(port) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
    socket.once("error", reject);
  });
}

function onceClosed(child) {
  return new Promise((resolve) => child.once("close", resolve));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
