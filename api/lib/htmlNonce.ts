export function addNonceToInlineScripts(html: string, nonce: string): string {
  if (!nonce) {
    return html;
  }

  return html.replace(
    /(<script(?![^>]*\bsrc=)(?![^>]*\bnonce=)[^>]*)(>)/g,
    `$1 nonce="${nonce}"$2`,
  );
}
