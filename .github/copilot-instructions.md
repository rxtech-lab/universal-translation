# Copilot Instructions

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.

Format: `<type>(<optional scope>): <description>`

Examples:
- `feat: add translation export feature`
- `fix(auth): resolve session expiry issue`
- `docs: update README with setup instructions`
- `chore: update dependencies`

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`, `build`.

## Package Manager

Use **Bun** as the package manager. Do not use npm, yarn, or pnpm.

- Install dependencies: `bun install`
- Add a dependency: `bun add <package>`
- Add a dev dependency: `bun add -d <package>`
- Run scripts: `bun run <script>`
