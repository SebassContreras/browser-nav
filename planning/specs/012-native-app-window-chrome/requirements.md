# 012 - native-app-window-chrome - Requirements

## What's being built

Restore native OS window decorations (title bar, window control buttons: minimize, maximize, close, and drag-to-move capabilities) in standalone PWA mode while keeping the web navigation elements (tabs toolbar and URL/address bar) hidden. Additionally, document and verify window closing mechanisms via standard OS controls and the CLI.

## Who it serves

End-users and automated testing workflows who need normal desktop window management (moving windows, minimizing to taskbar, closing via native 'X' button or CLI) without web browser navigation noise.

## Requirements

- R1@1: Native window chrome visibility: standalone PWA windows must display the native OS title bar and standard window controls (minimize, maximize, close) without showing browser tabs or URL navigation bars.
- R2@1: Window drag and placement: users and automation must be able to drag the application window by its native title bar area.
- R3@1: Graceful closure: windows must close cleanly when the native 'X' button is clicked or when requested via CLI/process management, properly releasing the BiDi debugging session and profile locks.
- R4@1: Preference alignment: configure `user.js` and `userChrome.css` profiles to enable native titlebar styling without breaking BiDi or profile isolation.

## Out of scope

- Custom HTML/in-DOM synthetic window bars.
- Browser extensions or toolbar buttons (e.g., Bitwarden or extensions inside the window header).
- Credential entry helper modes or clean mode toggles.

## Dependencies

- 004 (standalone-pwa-no-extension).

## Owner split

Agent: configuration changes, unit tests, CSS validation. Human: interactive verification of window dragging, minimization, and closing.
