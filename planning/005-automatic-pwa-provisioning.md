# 005 — automatic-pwa-provisioning

## Goal
Automatic on-the-fly PWA provisioning engine that creates, configures, and launches any requested target URL or domain as a native standalone PWA on demand. Eliminates artificial navigation blocks and manual PWA installations by automatically establishing the required PWA metadata and isolated profiles in the background.

## Requirements
- R1: On-the-fly provisioning: navigating to an uninstalled URL automatically registers and sets up a standalone PWA configuration in the background.
- R2: Arbitrary domain navigation: links or commands targeting uninstalled external origins are automatically provisioned and launched in standalone mode without being blocked.
- R3: Per-domain isolated profiles: each provisioned PWA maintains an independent profile directory to isolate cookies, local storage, and authentication.
- R4: Transparent execution: agents and CLI commands (`pwa-nav open <url>`) seamlessly launch newly provisioned PWAs without requiring user intervention.

### Who it serves
Users and agents browsing arbitrary websites who want every visited domain to behave as a dedicated, standalone PWA app without manual registration or installation friction.

### Out of scope
- Removing legacy PWAsForFirefox code paths (deferred to Spec 006).

### Dependencies
- 004 (standalone-pwa-no-extension).

### Owner split
Agent: code, tests, docs. Human: validation of automatic multi-domain navigation.

## Design
### Approach

- D1 (R1, R2, R4): `PwaProvisioner` service interface (`src/browser/provisioner.ts`) isolates on-the-fly PWA resolution and registration behind an anti-corruption layer; given any target HTTP/HTTPS URL, it extracts a deterministic app slug (`appSlugFromUrl`) and automatically prepares standalone PWA configuration on demand without extension messaging or manual user registration. _(standard: W3C Web App Manifest & URL origin partitioning - https://www.w3.org/TR/appmanifest/)_
- D2 (R1, R3): Profile management delegates directly to the composable `ensureStandaloneProfile(appSlug, { cacheDir })` service, guaranteeing each provisioned domain possesses a dedicated, isolated profile folder (`.agent/apps/<appSlug>/profile`) with BiDi preferences enabled and clean cookies/storage boundaries. _(standard: Firefox user.js profile isolation - https://developer.mozilla.org/en-US/docs/Mozilla/Preferences/A_brief_guide_to_preferences)_
- D3 (R1, R2, R4): `BidiBackend.open()` integrates transparent on-the-fly provisioning via the injected `PwaProvisioner` when `--launch` is active (or target is unlaunched) and the target is not already listening, auto-spawning the standalone PWA instance with `launchStandaloneApp` and auto-allowing the origin without manual installation blocks. _(judgement, no standard)_

### Deliverables

- `src/browser/provisioner.ts` - `PwaProvisioner` interface, options, and `DefaultPwaProvisioner` implementation (D1, D2).
- Updates to `src/browser/bidi-backend.ts` - integrate provisioner into `open()` workflow for transparent fallback when target is uninstalled/unlaunched (D3).
- Unit tests in `src/browser/test/provisioner.test.ts` (D1, D2).
- Integration tests in `src/browser/test/bidi-backend.test.ts` covering automatic provisioning during navigation (D3).

### Sequencing

D1 and D2 provide the isolated provisioning service and unit verification. D3 wires it into `BidiBackend.open` and end-to-end tool navigation.

### Open questions

None.

## Tasks
- [x] 005/T001 [agent] Define PwaProvisioner service interface and implement DefaultPwaProvisioner with slug extraction and isolated profile initialization — covers D1, D2
- [x] 005/T002 [agent] Implement standalone launch delegation in PwaProvisioner for arbitrary targets — covers D1, D3
- [x] 005/T003 [agent] Integrate PwaProvisioner into BidiBackend.open() to automatically provision uninstalled origins on demand — covers D3
- [x] 005/T004 [agent] Test: Unit test DefaultPwaProvisioner creates dedicated profile and resolves slug deterministically — covers R1, R3, D1, D2
- [x] 005/T005 [agent] Test: Provisioner launches standalone process with isolated profile and remote debugging port — covers R1, R4, D1, D3
- [x] 005/T006 [agent] Test: BidiBackend.open seamlessly provisions and navigates to arbitrary uninstalled domain — covers R2, R4, D3
- [ ] 005/T007 [human] Verify opening an arbitrary website launches in a dedicated standalone PWA window without manual installation — covers R2, R4
