# 風險四檔（DEC-0010）— 實作參考

**主標：** `evaluation.riskBandZh`（繁體香港用字）

| 分檔 | 典型條件（簡） |
|------|----------------|
| 風險偏高 | 嚴重矩陣／F–E／bound 糾紛 ≥3 等 |
| 風險中等 | 有糾紛信號但未達偏高 |
| 中性 | **bound=0** 或 bound>0 但無糾紛／無讚揚門檻 |
| 未見負面摘要 | bound 讚揚 ≥1、無糾紛（Legal 弱化「良好」後用字） |

發版前仍跑 `pnpm eval:report-quality --live --gate`；含 `riskBandZh` 断言。

- [DEC-0010](../decision-log/DEC-0010-risk-band-display-grading.md)
- `/legal/disclaimer` v1.1.1
