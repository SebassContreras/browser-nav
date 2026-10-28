# 038 — interactive-windows-launch

## Goal
Provide clear interactive execution guidance and shortcut details for Windows users when assisted authentication runs from background or non-interactive agent harnesses, preventing silent headless launch states.

## Requirements
- R1: When `authTool` runs on Windows and assisted authentication requires manual user sign-in, the tool's structured output and text message return the exact interactive launch command (`Start-Process ...`) and desktop shortcut details.
- R2: Documentation in `docs/firefox-runtime.md` and `AGENTS.md` explicitly details the Windows virtual desktop behavior and recommends using the Start Menu shortcut or exact command to attach to the user's interactive monitor.

## Design
- D1 (R1): In `src/ops/auth-workflow.ts` and `src/tools/auth.ts`, capture the `cleanResult.command` and desktop shortcut path from `WindowsShortcutService`. Surface them in the tool's structured response (`command`, `shortcutPath`, `interactiveHint`).
- D2 (R2): Update `docs/firefox-runtime.md` with a section on Windows background agent harnesses and interactive desktop window rendering.

## Tasks
- [ ] 038/T001 [agent] Unit test in `src/tools/test/auth-fallback.test.ts` checking structured interactive command output on Windows — covers R1
- [ ] 038/T002 [agent] Expose interactive launch command and shortcut path in `authTool` response — covers D1
- [ ] 038/T003 [agent] Update `docs/firefox-runtime.md` with Windows interactive session guidance — covers R2, D2
