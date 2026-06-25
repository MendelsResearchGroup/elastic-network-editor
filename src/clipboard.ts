type ClipboardWriter = {
  writeText(text: string): Promise<void>;
};

export function copyText(
  text: string,
  clipboard: ClipboardWriter = navigator.clipboard
) {
  return clipboard.writeText(text);
}
