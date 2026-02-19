# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `bun run dev` (Next.js on localhost:3000)
- **Build:** `bun run build`
- **Lint:** `bun run lint` (ESLint with Next.js core-web-vitals + TypeScript rules)
- **Install deps:** `bun install`
- **Add shadcn component:** `bunx shadcn@latest add <component-name>`

## Architecture

Next.js 16 app using the App Router with React 19 and TypeScript. Uses Bun as the package manager.

### Key Directories

- `app/` — App Router pages and layouts. Single root layout with Geist + Inter fonts.
- `components/ui/` — shadcn/ui components (radix-lyra style, Base UI/Radix primitives)
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

### Database

- **Turso** (libSQL) as the database, using `@libsql/client`
- **Drizzle ORM** for schema and queries, `drizzle-kit` for migrations

### Authentication

- **Auth.js** (next-auth v5) with OAuth providers
- Only the user ID is stored locally — no name, email, or profile data
- Any table that needs a user reference stores a `user_id` column

### AI

- **Vercel AI SDK 6** (`ai` package) for AI features

### Styling

- Tailwind CSS v4 with PostCSS
- CSS variables for theming defined in `app/globals.css` (light + dark mode via `.dark` class)
- shadcn/ui configured with `stone` base color, `lucide` icons, CSS variables, zero border radius

### Path Aliases

`@/*` maps to project root (e.g., `@/components/ui/button`, `@/lib/utils`)

## Conventions

- Prefer server actions over REST API routes for CRUD operations
- Install dependencies with `bun add <package>` — do not manually edit `package.json`
- Always use the latest version of dependencies
- shadcn config in `components.json` — RSC enabled, aliases for `@/components`, `@/lib`, `@/hooks`
