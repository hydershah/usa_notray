# Collapsible Hotkey Shortcuts Panel

## Overview
The Active Shortcuts panel in the editor has been made collapsible to provide a cleaner interface while still keeping important keyboard shortcuts accessible.

## Features
- **Collapsible Interface**: Click the header to expand/collapse the shortcuts panel
- **Persistent State**: The collapsed state is saved to localStorage and persists across page refreshes
- **Compact View**: When collapsed, shows only the header with current selection status
- **Visual Feedback**: Hover states and smooth transitions for better user experience
- **Always Visible**: The panel is now shown in all environments (not just development)

## UI Elements
- **Header**: Shows "Active Shortcuts" with a keyboard icon
- **Toggle Button**: Chevron icon that changes direction based on state
- **Selection Status**: When collapsed, displays the current user and tag selection
- **Shortcuts List**: Full list of keyboard shortcuts when expanded

## Keyboard Shortcuts Reference
When expanded, the panel shows:
- **User Selection**:
  - ` (backtick) → Select Notary
  - 1-8 → Select Signers
- **Tag Types**:
  - A → Name tag
  - S → Signature tag
  - I → Initials tag
  - N → Commission Number (notary only)
  - X → Commission Expiration (notary only)
  - O → Disclosure (notary only)
  - E → Seal (notary only)
  - W → Whiteout (notary only)
  - T → Text tag
  - D → Date tag
- **Navigation**:
  - Del → Delete selected tag
  - Esc → Deselect
  - Arrow keys → Move selected tag
  - PgUp/PgDn → Navigate pages
  - Ctrl+Z/Y → Undo/Redo

## Implementation Details
- Located in: `client/src/components/editor/HotkeyHandler.tsx`
- State persisted in localStorage key: `hotkey-shortcuts-collapsed`
- Shows current selected user and tag type
- Automatically updates based on editor state

## Benefits
1. **Cleaner Interface**: Takes up less screen space when not needed
2. **Quick Reference**: Can be expanded when needed
3. **Context Aware**: Shows current selection even when collapsed
4. **User Preference**: Remembers collapsed state between sessions 