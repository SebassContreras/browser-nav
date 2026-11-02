# 038 — interactive-windows-launch

## Goal
Provide clear interactive execution guidance and shortcut details for Windows users when assisted authentication runs from background or non-interactive agent harnesses, preventing silent headless launch states.

## Requirements
- R1: When `authTool` runs assisted authentication (either explicitly via `clean: true` or `action: "clean"`, or falling back from unauthenticated cookie relay), the tool's structured output and text message return interactive execution guidance across platform partitions:
  - On Windows (`process.platform === "win32"`): returns PowerShell interactive launch command (`Start-Process -FilePath ... -ArgumentList ...`), resolved desktop shortcut path (`.lnk` in app directory, or `null` if shortcut generation failed or unsupported), and an `interactiveHint` explaining how to bring the browser to the foreground if running in a background agent sandbox.
  - On non-Windows platforms (Linux/macOS): returns the standard CLI spawn command, `shortcutPath: null`, and a platform-appropriate interactive hint.
  - Invariants: `structured` outcome retains `status` (`"authenticated"` or `"unauthenticated"`), `siteId`, `port`, and `assisted: true`, while consistently adding `command: string`, `shortcutPath: string | null`, and `interactiveHint: string`. Both success and failure/timeout outcomes preserve these interactive fields so the user/agent can inspect and launch interactively.
- R2: Documentation in `docs/firefox-runtime.md` and operational guidance in `AGENTS.md` explicitly details Windows session isolation and virtual desktop sandboxing (e.g. Session 0 / Antigravity exebox sandboxes), why Firefox processes spawned in background agent sessions do not render on the interactive desktop, and provides explicit instructions to execute the PowerShell `Start-Process` command or open the provisioned `.lnk` shortcut.

## Design
- D1 (R1): In `src/ops/auth-workflow.ts`, update `AssistedAuthResult` and `AuthWorkflowOrchestrator` to capture `command` and resolve `shortcutPath` (from `cleanResult` and provisioned app directory). In `src/tools/auth.ts`, extract `command`, resolve shortcut path, and construct `interactiveHint` (formatting PowerShell `Start-Process` syntax on `win32`). Include `command`, `shortcutPath`, and `interactiveHint` in `ToolOutcome.structured` and append interactive launch instructions to `ToolOutcome.text` on both success and failure/timeout paths.
- D2 (R2): In `docs/firefox-runtime.md`, add a dedicated subsection "Windows background agent harnesses and interactive desktop rendering" detailing Windows session and window station boundaries (`WinSta0\Default`), why background agent shells cannot display GUI windows to the logged-in user, and recommending launching via PowerShell `Start-Process` or desktop shortcuts. In `AGENTS.md`, add operational instructions in the critical rules / workflows summary for handling assisted authentication prompts on Windows. Sources: Microsoft Learn, "Window Stations and Desktops" https://learn.microsoft.com/en-us/windows/win32/winstation/window-stations-and-desktops (accessed 2026-11-02); Microsoft Learn, "Session 0 Isolation" https://learn.microsoft.com/en-us/windows/win32/services/services-and-rpc-security (accessed 2026-11-02).

### Trade-offs & Mitigations
- Interactive command guidance in tool response vs automated GUI elevation: Background agent harnesses on Windows run inside isolated desktops or sandbox jobs where spawned child processes cannot attach to `WinSta0\Default`. Automatically attempting to break out of session isolation requires elevated system privileges or security-sensitive APIs. *Mitigation:* Surface the exact interactive launch command (`Start-Process ...`) and `.lnk` shortcut in both `text` and `structured` output, allowing the user or outer shell to launch Firefox directly into the interactive monitor while `authWatcher` polls for authentication.
- Platform-specific interactive syntax vs unified outcome contract: Windows requires PowerShell `Start-Process` quoting with `.lnk` shortcuts, whereas Linux/macOS run standard POSIX background commands. *Mitigation:* The tool branches on platform when formatting the command and hint, but returns a strictly uniform `structured` schema (`command: string`, `shortcutPath: string | null`, `interactiveHint: string`) across all platforms.

## Tasks
- [x] 038/T001 [agent] Table-driven unit tests in `src/tools/test/auth-fallback.test.ts` checking structured interactive guidance across partitions (Windows with `Start-Process` and shortcut path, Windows with shortcut null/missing, non-Windows platform fallback, clean mode, and timeout failure outcome) — covers R1, D1
      verified: `npx tsx --test src/tools/test/auth-fallback.test.ts` passed 8/8 tests covering all table-driven interactive partitions
- [x] 038/T002 [agent] Expose interactive launch command, shortcut path, and interactive hint in `authTool` structured and text responses in `src/tools/auth.ts` and `src/ops/auth-workflow.ts` — covers R1, D1
      verified: `authTool` and `AuthWorkflowOrchestrator` capture command, resolve shortcutPath, format interactiveHint, passing all unit tests and linter
- [x] 038/T003 [agent] Update `docs/firefox-runtime.md` and `AGENTS.md` with Windows interactive session guidance, virtual desktop isolation details, and launch recipes — covers R2, D2
      verified: documented Windows background agent harnesses and interactive desktop rendering in `docs/firefox-runtime.md` and added summary rule in `AGENTS.md`
- [x] 038/T004 [agent] Verify: run CI gate (`pnpm lint`, `pnpm build`, `pnpm test`, `pnpm smoke`) across touched modules (`src/tools/`, `src/ops/`, `docs/`, `AGENTS.md`) — covers R1, R2, D1, D2
      verified: `pnpm lint`, `pnpm build`, `pnpm smoke`, and `npx tsx --test` across touched test suites passed with 0 errors across 251 tests

## Changes
- 2026-11-02: Text audit:
  - F1: Added `### Trade-offs & Mitigations` under `## Design` documenting interactive launch guidance versus automated GUI elevation and platform-specific syntax versus unified schema (ENG-6).
  - F2: Refined R1 and R2 with concrete platform partitions (Windows vs POSIX), shortcut availability states, structured response contract invariants, and failure/timeout retention (TEST-I1, TEST-I2, ENG-1).
  - F3: Separated concerns between `src/ops/auth-workflow.ts` and `src/tools/auth.ts` in D1 (ENG-2) and cited Microsoft Learn specifications for Windows Session 0 and Window Station/Desktop boundaries in D2 (ENG-7).
  - F4: Aligned R2, D2, and T003 to include `AGENTS.md` alongside `docs/firefox-runtime.md` for operational agent guidance (TRACE, ARCH-3).
  - F5: Rewrote T001 to specify table-driven test shape, input partitions, boundaries, and contract assertions (TEST-I1, TEST-I2, TEST-H2).
  - F6: Aligned task coverage tags on T001 and T002 (`— covers R1, D1`) and added T004 CI gate verification task (TRACE).
