/** The keyboard map, shared by the help sheet and the settings page. */
export const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "⌘K / Ctrl K", description: "Open the command palette" },
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
