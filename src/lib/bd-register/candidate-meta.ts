import { readFile } from "node:fs/promises";
import { sha256Hex } from "./fetch-csv";

export type BdRegisterFetchMeta = {
  retrieved_at?: string;
  sha256?: string;
};

/** `retrieved_at` only when candidate bytes match meta `sha256`. */
export async function resolveCandidateRetrievedAt(
  candidatePath: string,
  metaPath: string,
): Promise<string | null> {
  try {
    const [candidateBuf, metaRaw] = await Promise.all([
      readFile(candidatePath),
      readFile(metaPath, "utf8"),
    ]);
    const meta = JSON.parse(metaRaw) as BdRegisterFetchMeta;
    if (!meta.retrieved_at || !meta.sha256) return null;
    if (sha256Hex(candidateBuf) !== meta.sha256) return null;
    return meta.retrieved_at;
  } catch {
    return null;
  }
}
