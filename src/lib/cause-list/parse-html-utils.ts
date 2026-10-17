/** Strip tags and collapse whitespace for cause-list table cells. */
export function htmlCellText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
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
