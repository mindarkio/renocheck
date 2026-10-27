# Consent `quote-azure-1`

**DRAFT, needs Aaron's approval (D3a).** Not wired to any page or API. `QUOTE_CONSENT_VERSION` is not in code yet. If this text ships later unchanged, the id stays `quote-azure-1` because it has never been shown (D40). If a different text ships first, the corrected text becomes `quote-azure-2`.

Sources for the claims (read 2026-10-19/20), from plan §8.4:

- https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy
- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/abuse-monitoring

Current Microsoft docs do not state an abuse-monitoring retention period. Older docs said up to 30 days (D38). Do not shorten that to a flat 「最多 30 日」.

## Notice above the checkbox

> 上載之前請睇清楚：
> - 報價單會原檔傳送俾 Microsoft 嘅 Azure OpenAI 服務做分析。Microsoft 係以資料處理者身份，代 RenoCheck（MindArk IO Ltd）處理。
> - 分析會喺香港以外地方進行，可能係任何一個有提供呢個 AI 模型嘅 Azure 地區（例如美國、歐洲或者亞太區）；如果有內容需要儲存，會儲存喺南韓。
> - 按 Microsoft 公布嘅說明，傳送嘅內容唔會用嚟訓練或者改進 AI 模型，OpenAI 公司亦睇唔到。
> - Microsoft 會用自動系統檢查有冇濫用。如果內容被標記，或者被認為屬於可能濫用嘅使用模式，Microsoft 可能會儲存相關內容，並可能由獲授權嘅 Microsoft 員工人手審閱。Microsoft 現時嘅公開文件冇寫明保存期（以往文件寫最多 30 日）。
> - 報價單上面嘅個人資料，包括其他人（例如師傅、公司職員）嘅姓名、電話、地址同簽名，都會一齊傳送。
> - 一經傳送，無法撤回，RenoCheck 亦無法要求 Microsoft 刪除佢嗰邊嘅內容。
> - RenoCheck 自己唔會儲存原檔。
> - 你每次上載都要重新同意；唔同意就唔好上載，公司查冊照常可以用。

## Checkbox label

> ☐ 我同意將報價單傳送俾 Microsoft Azure OpenAI，喺香港以外地方分析，並會盡量先遮住其他人嘅個人資料。

Under it, a link 「Azure OpenAI 資料私隱說明（英文）」 to https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy.

Error when submitted unticked: 「請先剔選同意，先可以開始分析。」

The checkbox is unticked by default, once per upload, with no "remember me". Withdrawing means not uploading.
