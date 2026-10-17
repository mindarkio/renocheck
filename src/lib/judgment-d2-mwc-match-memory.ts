import { suggestLookupAliases } from "./judgment-lookup-match";
import type { MwcMatchSummary } from "./judgment-d2-gates";
import type { MwcContractorsMemoryIndex } from "./mwc-contractors-memory-index";

/** Sync MWC lookup for D2 filter (in-memory index, no per-row DB). */
export function lookupMwcForPartyLabelMemory(
  index: MwcContractorsMemoryIndex,
  label: string,
  allPartyLabels: string[] = [],
): MwcMatchSummary | null {
  const terms = new Set<string>([label.trim()]);
  for (const a of suggestLookupAliases(label, allPartyLabels)) {
    terms.add(a);
  }

  let sawAmbiguous = false;
  for (const term of terms) {
    if (term.length < 2) continue;
    const { row, ambiguous } = index.lookupWithMeta({
      companyName: term,
    });
    if (ambiguous) sawAmbiguous = true;
    if (row && !ambiguous) {
      return {
        companyName: row.company_name,
        registrationNo: row.registration_no,
        ambiguous: false,
      };
    }
  }

  if (sawAmbiguous) {
    return {
      companyName: label,
      registrationNo: "",
      ambiguous: true,
    };
  }
  return null;
}
