# Manufacturing Quality Dashboard

A responsive React dashboard for manufacturing quality performance, inspection analysis, defect taxonomy, department inputs, access workflows, and master-data maintenance.

## Requirements

- Node.js 20 or newer
- pnpm 9 or newer

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173/ after the development server starts.

## Verify and build

```bash
pnpm test
pnpm build
pnpm preview
```

The production files are emitted to dist/ and are intentionally ignored by Git.

## Main workspaces

- Executive Overview for KPI cards, trends, part contribution, and drill-down filters
- Quality Explorer for detailed inspection and defect analysis
- Department Inputs for draft quality records and workflow submission
- Access & Workflows for users, review queue, and audit history
- Database Settings for suppliers, customers, parts, processes, work centers, and defect taxonomy

The bundled demo data is stored in browser storage for local demonstration. It is not a production authentication or multi-user persistence layer. Historical transaction values are preserved when master records are renamed or deactivated.

## Project structure

- src/data/qualityData.ts: quality calculations, filtering, taxonomy, and workbook behavior
- src/data/accessControl.ts: roles, permissions, and workflow rules
- src/data/masterData.ts: shared master-data state and migrations
- src/components/: dashboard workspaces and UI components
- src/i18n.tsx: English and Chinese translations

## Publishing

This is a client-side Vite application and can be published to any static host. Run pnpm build, then deploy the generated dist/ directory. Configure the host to serve index.html for unknown routes if history-based navigation is enabled.

Do not commit local exports, backups, spreadsheet inspection files, or browser-generated artifacts; these are covered by .gitignore.
