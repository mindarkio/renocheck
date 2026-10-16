import type { SupabaseClient } from "@supabase/supabase-js";
import { suggestLookupAliases } from "./judgment-lookup-match";
import type { MwcMatchSummary } from "./judgment-d2-gates";
import { lookupMwcWithMeta } from "./mwc-lookup";

/** Try party label + alias variants against mwc_contractors (D2 Gate 3). */
export async function lookupMwcForPartyLabel(
  supabase: SupabaseClient,
  label: string,
  allPartyLabels: string[] = [],
): Promise<MwcMatchSummary | null> {
  const terms = new Set<string>([label.trim()]);
  for (const a of suggestLookupAliases(label, allPartyLabels)) {
    terms.add(a);
  }

  let sawAmbiguous = false;
  for (const term of terms) {
    if (term.length < 2) continue;
    const { row, ambiguous } = await lookupMwcWithMeta(supabase, {
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
