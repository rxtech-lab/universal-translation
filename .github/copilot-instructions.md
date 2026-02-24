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

## i18n / Translation Files

Before each commit, ensure `messages/zh.po` has Chinese translations for all new or changed strings:

1. Run `bun run build` to extract new strings into `messages/en.po`.
2. Check `messages/zh.po` for any empty `msgstr ""` entries (excluding the header on line 2).
3. Fill in proper Chinese translations for all empty entries.
4. Never commit `messages/zh.po` with empty `msgstr` values for new strings.
