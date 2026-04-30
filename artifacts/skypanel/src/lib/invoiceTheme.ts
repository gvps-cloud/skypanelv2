function resolveCSSVar(varName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value ? `hsl(${value})` : '';
}

export function injectInvoiceTheme(htmlContent: string): string {
  const bg = resolveCSSVar('--background');
  const fg = resolveCSSVar('--foreground');
  const card = resolveCSSVar('--card');
  const cardFg = resolveCSSVar('--card-foreground');
  const muted = resolveCSSVar('--muted');
  const mutedFg = resolveCSSVar('--muted-foreground');
  const border = resolveCSSVar('--border');
  const primary = resolveCSSVar('--primary');
  const primaryFg = resolveCSSVar('--primary-foreground');
  const secondary = resolveCSSVar('--secondary');
  const secondaryFg = resolveCSSVar('--secondary-foreground');
  const accent = resolveCSSVar('--accent');
  const accentFg = resolveCSSVar('--accent-foreground');
  const destructive = resolveCSSVar('--destructive');
  const destructiveFg = resolveCSSVar('--destructive-foreground');

  const themeCSS = `<style data-invoice-theme>
body { background: ${bg} !important; color: ${fg} !important; }
.container { background: ${card} !important; color: ${cardFg} !important; }
.header { border-bottom-color: ${primary} !important; }
.company-info h1 { color: ${primary} !important; }
.invoice-info h2 { color: ${primary} !important; }
.company-info p { color: ${mutedFg} !important; }
.invoice-meta { background: ${secondary} !important; }
.invoice-meta-label { color: ${mutedFg} !important; }
.invoice-meta-value { color: ${cardFg} !important; }
table thead { background: ${secondary} !important; }
table th { color: ${secondaryFg} !important; border-bottom-color: ${border} !important; }
table td { border-bottom-color: ${border} !important; color: ${cardFg} !important; }
.totals-row { border-bottom-color: ${border} !important; }
.totals-row.total { border-bottom-color: ${primary} !important; color: ${primary} !important; }
.status-badge { background: ${secondary} !important; color: ${secondaryFg} !important; }
.status-badge.issued { background: ${primary} !important; color: ${primaryFg} !important; }
.status-badge.paid { background: ${accent} !important; color: ${accentFg} !important; }
.status-badge.draft { background: ${muted} !important; color: ${mutedFg} !important; }
.status-badge.cancelled { background: ${destructive} !important; color: ${destructiveFg} !important; }
.footer { border-top-color: ${border} !important; color: ${mutedFg} !important; }
h3 { color: ${primary} !important; }
</style>`;

  return htmlContent.replace('</head>', `${themeCSS}\n</head>`);
}
