export type SearchPipelineErrorCode =
  | "supabase_unavailable"
  | "serp_unavailable"
  | "serp_failed"
  | "llm_unavailable"
  | "llm_failed";

export class SearchPipelineError extends Error {
  readonly code: SearchPipelineErrorCode;

  constructor(code: SearchPipelineErrorCode, message?: string) {
    super(message ?? code);
    this.name = "SearchPipelineError";
    this.code = code;
  }
}
