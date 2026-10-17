function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) =>
      String.fromCodePoint(Number.parseInt(n, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    );
}

/** Strip tags; preserve <br> as newlines. */
export function htmlCellText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function extractTableRows(html: string): string[] {
  const rows: string[] = [];
  const re = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    rows.push(m[1]);
  }
  return rows;
}

export function extractRowCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml)) !== null) {
    cells.push(htmlCellText(m[1]));
  }
  return cells;
}

/** DDMMYYYY → YYYY-MM-DD */
export function parseDclListDate(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) throw new Error(`invalid DCL date: ${ddmmyyyy}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function ddMmYyyyToSortable(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) throw new Error(`invalid DCL date: ${ddmmyyyy}`);
  return `${m[3]}${m[2]}${m[1]}`;
}
