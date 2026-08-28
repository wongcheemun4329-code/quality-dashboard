# Manufacturing Quality Dashboard Transfer Guide

This archive contains the current portable source for the Manufacturing Quality Dashboard.

## Included

- React and TypeScript application source
- Dashboard, Quality Explorer, Data Manager, and Access & Workflows features
- NPI and Production monitoring
- Supplier and customer master databases
- Customer Complaint, Incoming, IPQA, and OQA analysis
- Focused process-specific paint defect taxonomy with Level 1 and Level 2 filtering
- Workbook import, validation, templates, and export logic
- Automated tests
- Vite and TypeScript configuration
- Exact dependency lockfile

## Not Included

- `node_modules/` (machine-specific installed packages)
- `dist/` (generated production build)
- `.git/` metadata
- `backups/` and `outputs/` (older revisions and generated artifacts)
- Browser local storage from the original account

The dashboard automatically recreates its bundled demo dataset and master data when opened in a fresh browser.

## Start The Project

Requirements: Node.js 20 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Then open:

```text
http://127.0.0.1:5173/
```

## Verify

```bash
pnpm test
pnpm build
```

Expected baseline at packaging time:

- 21 test files
- 284 tests passing
- TypeScript compilation passing
- Production build passing

## Continue In Another ChatGPT Account

Upload the ZIP archive and use a prompt such as:

```text
Extract and inspect this Manufacturing Quality Dashboard project. Preserve the existing dashboard, data model, tests, responsive layout, workbook workflows, and browser-local persistence. Run the existing tests and build before making changes. Continue development from the current implementation described in TRANSFER_README.md.
```

## Persistence Notes

The app is currently a local demo application. Quality data and Access & Workflows state are stored in browser local storage. A new browser or ChatGPT account begins with deterministic seeded demo data. For multi-user production deployment, replace browser-local persistence with a shared authenticated backend and database.
