type SelectableField = Pick<
  HTMLInputElement,
  "focus" | "select" | "setSelectionRange"
>;

export async function copyInviteUrl(
  url: string,
  field: SelectableField | null,
  clipboard?: Pick<Clipboard, "writeText">,
  legacyCopy?: () => boolean,
): Promise<"copied" | "selected" | "failed"> {
  if (clipboard) {
    try {
      await clipboard.writeText(url);
      return "copied";
    } catch {
      // Older browsers and denied clipboard permissions can use the field.
    }
  }
  if (!field) return "failed";
  field.focus();
  field.select();
  try {
    field.setSelectionRange(0, url.length);
  } catch {
    // Some browsers select the field but do not support setSelectionRange.
  }
  try {
    if (legacyCopy?.()) return "copied";
  } catch {
    // Keep the URL selected so the user can copy it manually.
  }
  return "selected";
}
