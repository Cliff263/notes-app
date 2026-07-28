/** The keyboard map, shared by the help sheet and the settings page. */
export const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "⌘K / Ctrl K", description: "Open the command palette" },
  { keys: "⌘B / Ctrl B", description: "Bold selected note text" },
  { keys: "⌘I / Ctrl I", description: "Italicize selected note text" },
  { keys: "⌘K / Ctrl K (editor)", description: "Add a link while editing" },
  { keys: "⌘Z / Ctrl Z", description: "Undo note editing" },
  { keys: "⌘⇧Z / Ctrl Y", description: "Redo note editing" },
  { keys: "Tab / Shift Tab", description: "Indent or outdent note lines" },
  { keys: "N", description: "New note" },
  { keys: "/", description: "Focus search" },
  { keys: "E", description: "Favorite the open note" },
  { keys: "P", description: "Pin the open note" },
  { keys: "A", description: "Archive the open note" },
  { keys: "G then C", description: "Go to the calendar" },
  { keys: "G then T", description: "Go to tags" },
  { keys: "?", description: "Show this list" },
  { keys: "Esc", description: "Close the note, sheet or dialog" },
];
