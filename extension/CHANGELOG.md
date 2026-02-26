# Changelog

All notable changes to the Power Automate Utility extension will be documented in this file.

## [1.0.3] - 2026-02-26

### Added
- **Show Connection References** command — Fetches connection references from the Dataverse `connectionreferences` table and displays them in a quick pick. Selecting a reference inserts it into the `connectionReferences` object in the active editor using the schema `{ api: { name }, connection: { connectionReferenceLogicalName }, runtimeSource: "embedded" }`. If no `connectionReferences` object exists, the snippet is inserted at the cursor position.
- Automatic unique key generation for inserted connection references (e.g., `shared_outlook_1`, `shared_outlook_2`).
- `listConnectionReferences` function in the Dataverse client.

## [1.0.2] - 2026-02-10

### Added
- **Environment Variable IntelliSense** — When listing flows, environment variables are now fetched from the `environmentvariabledefinition` table. Typing `@parameters(` suggests available environment variables, inserting them as `parameters('<Display Name> (<Schema Name>')`.
- **CHANGELOG.md** — Added changelog for VS Marketplace listing.

## [1.0.1] - 2025-12-01

### Added
- Flow editing commands: Sign In, List Flows, Open Flow ClientData, Update Flow ClientData.
- Multi-tenant support with saved environment lists per tenant.
- Editor title bar upload button for `.clientdata.json` files.

## [1.0.1] - 2025-10-01

### Added
- Action completion provider (`@@` pattern) for inserting action templates from `actions.json`.
- Copilot skill file auto-installation.

## [0.1.0] - 2025-08-01

### Added
- IntelliSense for Power Automate and Logic App expression functions in `.json`, `.jsonc`, and `.txt` files.
- Auto-complete, hover documentation, and signature help for all expression functions.
- Nested `@` symbol auto-removal inside expressions.
- Toggle IntelliSense on/off command.
- Bash script alternative for flow editing outside VS Code.
