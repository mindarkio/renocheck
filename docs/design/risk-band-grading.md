# 風險四檔（DEC-0010）— 實作參考

**主標：** `evaluation.riskBandZh`（繁體香港用字）

| 分檔 | 典型條件（簡） |
|------|----------------|
| 風險偏高 | 嚴重矩陣／F–E／bound 糾紛 ≥3 等 |
| 風險中等 | 有糾紛信號但未達偏高 |
| 中性 | **bound=0** 且無判詞升檔，或 bound>0 但無糾紛／無讚揚門檻 |
| 未見負面摘要 | bound 讚揚 ≥1、無糾紛（Legal 弱化「良好」後用字） |

發版前仍跑 `pnpm eval:report-quality --live --gate`；含 `riskBandZh` 断言。

- [DEC-0010](../decision-log/DEC-0010-risk-band-display-grading.md)
- **DEC-0012 例外：** `boundHitCount === 0` 時，若對照到**被告**且類別為工程／合約／小額錢債等（見 DEC-0012 Appendix B），仍可按規則升至「風險中等」等；勞資被告等預設不強制升檔。
- `/legal/disclaimer` v1.2.1
