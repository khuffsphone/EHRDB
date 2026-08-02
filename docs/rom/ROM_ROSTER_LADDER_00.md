# ROM-05A — Factory Roster and Career Bootstrap v01

> Static inspection of the verified World cartridge. The public report records structure, offsets, counts, and control-flow conclusions. Full names, raw records, and ladder data remain in the private non-release atlas.

## Evidence standard

- **VERIFIED_ROM** — exact bytes, offsets, count, stride, or hash match.
- **VERIFIED_CONTROL_FLOW** — a bounded 68000 sequence establishes how the data is indexed, copied, or combined.
- **SUPPORTED_SEMANTIC** — code structure plus independent player-facing context supports a meaning, but the complete subsystem is not yet traced.
- **UNRESOLVED** — no canonical semantic name is assigned.

## Factory fighter table

- ROM range: `0x0097E4–0x009D47`.
- Total bytes: `1,380`.
- Records: **60**.
- Record stride: **23 bytes (`0x17`)**.
- Per-record physical layout:
  - bytes `0–12`: fixed 13-byte display-name field;
  - bytes `13–17`: five compact metadata bytes, semantics unresolved;
  - bytes `18–21`: four rating bytes;
  - byte `22`: one three-value field, semantics unresolved.

### Control-flow proof

At `0x0087C2`, the loader multiplies the selected factory index by `0x17`, loads base `0x0097E4`, forms the indexed record address, and copies the first 18 bytes. A four-iteration transform loop beginning at `0x008806` consumes the next four bytes individually and writes four derived words to the runtime fighter record. This establishes a four-rating block without proving its semantic order.

The four values are candidates for the manual's Power, Stamina, Speed, and Defense attributes. Assigning those names in that order remains an inference until the UI/stat-rendering path or controlled emulator observations are traced.

## Internal fighter-ID dispatch

The dispatcher beginning at `0x00877E` reads a fighter ID from the runtime ladder and subtracts four.

- IDs `4–63` select the 60 factory records by `record_index = internal_id - 4`.
- IDs `0–3` take a separate path to RAM base `0xFFF89E` with a 34-byte (`0x22`) stride.

This proves four non-factory runtime fighter slots. It does **not** yet prove how many are exposed as saved Career profiles, whether all four persist, or which modes own them.

## Initial 30-rank ladder

A new-career bootstrap copies 90 consecutive bytes from ROM to RAM:

- copy sequence begins at `0x007E26`;
- ROM source: `0x009D48`;
- RAM destination: `0xFFF928`;
- byte count: 90.

The source is three parallel 30-byte arrays:

| Array | ROM range | RAM range | Count |
|---|---|---|---:|
| Internal fighter IDs | `0x009D48–0x009D65` | `0xFFF928–0xFFF945` | 30 |
| Wins | `0x009D66–0x009D83` | `0xFFF946–0xFFF963` | 30 |
| Losses | `0x009D84–0x009DA1` | `0xFFF964–0xFFF981` | 30 |

The 30 IDs are unique and all fall in the factory range `4–63`. Exactly 30 of the 60 factory records are active at bootstrap; the other 30 are inactive at that moment.

### Wins/losses conclusion

At `0x0087F0`, code reads a rank-matched byte from RAM `0xFFF946`, adds the rank-matched byte exactly 30 positions later, and caps the result at 47. That establishes paired count fields used as total prior bouts. The top-ranked licensed champion's row is `27` and `0`, independently matching a win/loss record. The array names **wins** and **losses** are therefore supported beyond string proximity alone.

The use of the 30 inactive factory records as later retirement or replacement entrants remains the leading interpretation, but insertion and retirement control flow is not yet closed.

## Correction to private atlas v0.3

The earlier private v0.3 narrative placed the bootstrap copy at `0x007E28`. The audited instruction sequence begins at `0x007E26`; the source-address operand itself begins later within that sequence. v0.4 supersedes the stale v0.3 location while preserving its otherwise verified table data.

## Comparison with TEN COUNT

| Original structure | TEN COUNT | Disposition |
|---|---|---|
| 60 factory records | Eight authored ranked opponents plus created boxer | Deliberate content compression |
| 30 active ranked slots | Eight-position ladder | Same topology, smaller population |
| 30 inactive factory records at bootstrap | No equivalent replacement pool established | Missing/optional expansion system |
| Four non-factory runtime IDs | One active created Career in settled canon | Runtime capacity differs; original player-facing meaning unresolved |
| Four compact rating bytes | Five modern fighter attributes and archetype parameters | Redesigned and expanded |

No original fighter name, likeness, raw record, or rating table enters the `SAFE_RELEASE` bundle. The value of this lane is architectural: it proves that roster expansion, a reserve/replacement pool, and multiple created-fighter records are authentic directions for an optional private fidelity mode or a rights-safe fictional expansion.

## Reproduction

```bash
python tools/rom/extract_roster.py /private/path/to/rom.bin \
  --out artifacts/private-repro/roster
python tools/rom/test_extract_roster.py -v
```

The extractor verifies the canonical ROM hash and five hash-only control-flow proofs before writing private JSON/TSV output.

## Next gates

1. Trace the inactive-record insertion and fighter-retirement path.
2. Trace the four rating bytes through stat display, training, ageing, and bout setup to prove semantic order.
3. Trace the final three-value field into AI/style selection.
4. Determine whether IDs `0–3` correspond to persistent profile slots, temporary created fighters, exhibition fighters, or a mixture.
5. Compare the original 30-rank replacement behavior against a fictional 30-position expansion of TEN COUNT without importing protected roster expression.
