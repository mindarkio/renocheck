# Track 1 真實判詞 seed — 人工／代理審閱（2026-10-16）

**範圍：** `scripts/fixtures/judgments-seed.local.json`（**15** 條，`renovationRelevant: true`）  
**對照：** [DEC-0012](../decision-log/DEC-0012-track1-court-judgments-v1-0-0.md) Appendix A/B、[compliance-legal](../../.cursor/rules/compliance-legal.mdc)、[`report-quality-human-signoff.md`](./report-quality-human-signoff.md) #11–13  
**審閱者：** Cursor Agent（**預審**；**唔**代替律師／合規負責人簽字）  
**自動佐證：** `pnpm judgment:poc-smoke --api-base=…`（15/15 lookup，2026-10-16）；DB RLS 見 [`judgment-ingestion-execution.md`](../plans/judgment-ingestion-execution.md) D3

## 總結

| 維度 | 結果 |
|------|------|
| 合規用詞（無指控性標籤） | **Pass** 15/15 |
| `companyNameNormalized` ∈ parties | **Pass** 15/15 |
| `partyRole` 與 parties 一致 | **Pass** 15/15 |
| `sourceUrl` LRS `ju_frame.jsp?DIS=` | **Pass** 15/15 |
| Appendix B 與 live API 抽樣 | **Pass** [Likely]（見下） |
| 判詞全文逐句核對 | **未做** — 要點依 LRS 列表／公開摘要 |
| D0.3 律師簽字 | **未做** — 大推／收費前仍建議法律睇 LRS 條款 |
| DEC-0012 GA `accepted` | **未做** |
| Track 1 **beta** owner 確認 | **Done** 2026-10-16 — [`owner-attestation-track1-beta.md`](./owner-attestation-track1-beta.md) |

**判定：** **Conditional Pass（可開 preview 內測）**；對外 v1.0 仍須 [`report-quality-human-signoff.md`](./report-quality-human-signoff.md) #11–13 + DEC-0012 GA。

**產品決策（2026-10-16）：** **維持 15 宗 seed**；owner 已簽 beta 確認表 1–5。

### Appendix B 抽樣（`POST /api/search`, `refresh: true`, bound=0）

| 查詢 | 角色 | 預期 | 實測 `riskBandZh` |
|------|------|------|-------------------|
| SING YU…（DCCJ 1033/2024） | 被告 + `judgment_against_defendant` | ≥ 風險中等 | 風險中等 |
| 林國富…（HCSA 4/2017） | 原告 + `partial_liability` | 唔當偏高；展示 | 中性 |
| 陳國新…（2 宗） | 被告 57/2024 + 原告 59/2014 | 取較嚴（被告敗訴） | 風險中等 |

## 逐條

| # | caseRef | 搜尋名 | 合規 | 一方一致 | outcome 與要點 | 備註 |
|---|---------|--------|:----:|:--------:|:--------------:|------|
| 1 | DCCJ 1033/2024 | SING YU DECORATION… | P | P | P | 缺席評估損賠；升檔合理 |
| 2 | DCCJ 907/2007 | 姚潤潮前經營希望裝修… | P | P | P | `outcomeHint: unknown` 保守；雙方均工程商 |
| 3 | HCSA 13/2024 | 楊國聰經營新寶… | P | P | P | `dismissed_or_withdrawn` 與駁回敘述一致 |
| 4 | HCSA 49/2017 | 譚松新經營信譽… | P | P | P | `partial_liability` |
| 5 | HCSA 28/2016 | 謝天健經營天穎… | P | P | P | 同上 |
| 6 | HCSA 62/2012 | 謝卓男經營卓男… | P | P | P | 原審命被告付款 + 上訴撤銷 |
| 7 | HCSA 57/2024 | 陳國新經營燊記… | P | P | P | 退款命令仍屬被告不利；與 `judgment_against_defendant` [Likely] 一致 |
| 8 | HCSA 47/2013 | 孫業波經營新誠業… | P | P | P | dismissed 敘述一致 |
| 9 | DCCJ 1463/2017 | MANSON WATER… | P | P | P | 泓都裝修；被告公司已校正 |
| 10 | HCSA 4/2017 | 林國富經營富記… | P | P | P | 原告承辦商；API 中性 |
| 11 | HCSA 55/2003 | 鄭來正經營新雅… | P | P | **F/u** | 要點偏泛；`unknown` 可接受 |
| 12 | HCSA 39/2017 | 陳啟生，梁鳳儀經營生記… | P | P | **F/u** | 僅上訴許可程序摘要 |
| 13 | DCCJ 625/2018 | LAM YIU FAI t/a ART CITY… | P | P | **F/u** | 原告；要點未寫裁決結果 |
| 14 | DCCJ 4239/2022 | PACIFICPLAN INTERIORS LTD | P | P | **F/u** | 室內被告；要點泛 |
| 15 | HCSA 59/2014 | 陳國新經營燊記… | P | P | **F/u** | 原告；已刪 seed 內 ops 用語 |

**P** = Pass；**F/u** = Follow-up（唔阻塞 PoC，建議日後對 LRS 全文補 `outcomeHint`）

## 仍須真人／D0.3

- [ ] [`judgments-sources.md`](../sourcedata/judgments-sources.md) 商業使用／司法條款（D0.3）
- [ ] DEC-0012 狀態 → **accepted**
- [ ] [`report-quality-human-signoff.md`](./report-quality-human-signoff.md) 全表（尤其 #11–13 UI 文案）
- [ ] 本表「審閱者」改為具名負責人 + 日期

## 修正記錄

- 2026-10-16：HCSA 59/2014 `hearingKeyPointsZh` 移除「LRS case-number 發現」內部用語 → 重新 `pnpm import:judgments --file=scripts/fixtures/judgments-seed.local.json`
