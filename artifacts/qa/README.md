# QA Evidence Index

| Path | What it is |
|---|---|
| `ACCEPTANCE_CHECKLIST.md` | Every acceptance gate, ticked against real output |
| `verify/` | Verbatim stdout/stderr from each `npm run verify` stage |
| `verify-summary.json` | Machine-readable pass/fail and timings |
| `soak.json` | 200 ranked AI-vs-AI bouts: outcomes, punch mixes, matchup matrix, deterministic hashes |
| `soak-mirror.json` | 200 control bouts with ratings held equal — the honest balance measurement |
| `career.json` | 12 complete careers: endings, grades, earnings, peak ranks |
| `smoke-report.json` | Browser end-to-end step results and console-error log |
| `screens-report.json` | Screenshot index, scenes verified, navigation assertions |
| `screens/1280x720/` | 28 screenshots |
| `screens/1920x1080/` | 28 screenshots |
| `screens/1024x768/` | 28 screenshots |
| `ring-check.png` | Ring composition check used while tuning the projection |

Deterministic hashes live in `soak.json` under `hashes`, formatted
`seed:fighterA:fighterB:stateHash`. Re-running `npm run soak` reproduces them
exactly.
