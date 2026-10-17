# MyLibrary — Product Requirements

## Goal
A private, local-first catalog for technical PDFs, EPUBs, audiobooks, physical books, and wishlists. No ISBN required. A book can have multiple editions and file/source records.

## Design baseline
Follow the approved dark navy / blue-accent desktop-and-mobile MyLibrary mockup. Extend it with Import Review and Custom Cover Editor screens. No redesign without approval.

## Import priorities
1. Select PDF/EPUB files or a folder with explicit permission.
2. Read embedded metadata, then title/copyright pages where text extraction permits; use filename as fallback.
3. Render PDF first-page preview or extract EPUB cover; support custom cover upload and generated fallback.
4. Stage candidate entries in Import Review with provenance and confidence; never silently treat inferred fields as verified.
5. Detect potential duplicates and preserve user edits on rescan.

## Privacy
Never upload book contents, notes, file paths, or account tokens without explicit user action. Public repository contains source code only. IndexedDB is device-local, not cross-device sync. Cloud connectors are future optional adapters.

## Milestones
M1a: App shell, responsive library grid, local persistence, basic file import. M1b: Real PDF/EPUB metadata and covers, import review, editing. M2: Wishlist, ratings, collections, ISBN search and scanning. M3: Folder companion and rescan. M4: Optional OAuth integrations and sync.
