# Karya — Portal Hak Cipta

An original Indonesian copyright portal prototype. **Phase 1 only**, with local mock state and no backend or official-service integration.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Select **Coba demo**, or enter a valid-format example email and any nonempty example password. Never enter real credentials. Mock login is kept in sessionStorage for the current tab; logout clears it. It is a UI demo, not secure authentication.

```sh
npm run build
npm run preview
```

## Implemented in Phase 1

- Vite + TypeScript with bundled DM Sans and Plus Jakarta Sans fonts.
- Login, password visibility, mock session, logout, and informative dialogs for future account services.
- Hash-based routes, login guard, unknown-route fallback, breadcrumbs, profile menu, notifications placeholder, and help dialog.
- Original responsive dashboard, empty application summary, journey guide, collapsible desktop sidebar, mobile drawer.
- All requested navigation routes and a phase roadmap.
- Three navigable application steps. Step 1 includes all eight visible fields, minimal illustrative select options, and a browser-native date input. Values remain in memory while the page stays open; they are not persisted through reloads.
- Step 2 structured creator/holder/representative placeholders. Step 3 lists all seven planned attachments.
- Previous, Next, and Save as Draft controls. Saving displays an honest planned-feature dialog; it does not save or report success. Document buttons likewise explain planned downloads.
- Labels, focus indicators, semantic navigation, keyboard-operable dialogs, skip link, and reduced-motion support.

## Planned

| Phase | Scope                                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2     | Complete field behavior, required validation, full dropdown lists, advanced date picker, progress persistence and draft success simulation.  |
| 3     | Representative selection, creator/holder tables, add/edit/delete, and modal steps for legal entity, identity and address.                    |
| 4     | File/link uploads, document templates, draft saving, confirmation and submission success.                                                    |
| 5     | Full dashboard, sample records, search/filter/sort, additional service pages and further responsive/accessibility/loading/error refinements. |

The brief mentions Phase 2 once for creator/holder management, but its dedicated Phase 3 and detailed build instructions consistently assign it to **Phase 3**, used here. Account registration, password recovery, verification email and SSO show explicit placeholders; real authentication needs separately scoped backend work beyond these frontend phases. The fee is example content specified by the brief, not a verified current fee.

## Project structure

- `src/main.ts`: routing, page templates, icons and local UI interactions.
- `src/style.css`: responsive design and visual identity.
- `public/favicon.svg`: original Karya favicon.

No API keys, environment variables, database or external accounts are needed.
