import type { CauseListParty, CauseListPartyRole } from "./types";
import { splitPartyBlock } from "./party";

export type PartyCellMode = "labeled" | "and_split";

function isStandaloneAndLine(line: string): boolean {
  return /^(AND|And)$/i.test(line.trim());
}

/** CACFI: plaintiffs before standalone And, defendants after (H2). */
export function parseAndSplitPartyCell(text: string): CauseListParty[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const andIdx = lines.findIndex((l) => isStandaloneAndLine(l));
  if (andIdx < 0) return [];

  const plaintiffBlock = lines.slice(0, andIdx).join("\n");
  const defendantBlock = lines.slice(andIdx + 1).join("\n");
  return [
    ...splitPartyBlock(plaintiffBlock, "plaintiff", { splitInlineAnd: false }),
    ...splitPartyBlock(defendantBlock, "defendant", { splitInlineAnd: false }),
  ];
}

function stripChineseRoleLabels(text: string): string {
  return text
    .replace(/^(原告人|被告人|申請人|答辯人)\s*/gmu, "")
    .replace(/被告人\s*$/gmu, "")
    .trim();
}

/** DC/LANDS: Plaintiff/Defendant/Applicant/Respondent labels + standalone AND rows (M8). */
export function parseLabeledPartyCell(text: string): CauseListParty[] {
  const cleaned = stripChineseRoleLabels(text);
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isStandaloneAndLine(l));

  const parties: CauseListParty[] = [];
  let role: CauseListPartyRole = "unknown";
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const block = buffer.join("\n");
    parties.push(
      ...splitPartyBlock(block, role, { splitInlineAnd: false }),
    );
    buffer = [];
  };

  for (const line of lines) {
    const labelMatch = line.match(
      /^(Claimant|Defendant|Plaintiff|Respondent|Applicant)\(?s?\)?\s*[:：]?\s*(.*)$/iu,
    );
    if (labelMatch) {
      flush();
      const label = labelMatch[1];
      if (/claimant/i.test(label)) role = "claimant";
      else if (/defendant/i.test(label)) role = "defendant";
      else if (/plaintiff/i.test(label)) role = "plaintiff";
      else if (/respondent/i.test(label)) role = "respondent";
      else if (/applicant/i.test(label)) role = "applicant";
      const rest = labelMatch[2]?.trim();
      if (rest) buffer.push(rest);
      continue;
    }
    if (/^被告人\s*$/iu.test(line)) continue;
    buffer.push(line);
  }
  flush();
  return parties;
}

export function parsePartyCell(text: string, mode: PartyCellMode): CauseListParty[] {
  if (!text.trim()) return [];
  if (mode === "and_split") return parseAndSplitPartyCell(text);
  return parseLabeledPartyCell(text);
}
