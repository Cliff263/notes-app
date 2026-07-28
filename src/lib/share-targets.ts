function noteTitle(title: string) {
  return title.trim() || "Untitled note";
}

/** Opens the device's configured mail app with the recipient left selectable. */
export function emailShareUrl(title: string, url: string) {
  const resolvedTitle = noteTitle(title);
  const params = new URLSearchParams({
    subject: `Nexora note: ${resolvedTitle}`,
    body: `Read “${resolvedTitle}” on Nexora:\n\n${url}`,
  });
  return `mailto:?${params.toString()}`;
}

/**
 * wa.me hands off to the WhatsApp app on mobile and WhatsApp Desktop/Web on
 * desktop, with no phone number so the user is shown the contact picker.
 */
export function whatsappShareUrl(title: string, url: string) {
  const resolvedTitle = noteTitle(title);
  const params = new URLSearchParams({
    text: `Read “${resolvedTitle}” on Nexora:\n${url}`,
  });
  return `https://wa.me/?${params.toString()}`;
}
