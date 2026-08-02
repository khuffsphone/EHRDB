# Heavyweight Circuit — artifact inspection

First-hand inspection of the supplied `heavyweightcircuitv1.1.0.html`, recorded
because two earlier documents in this project — the independent review and my
own response to it — reasoned about Heavyweight Circuit without anyone on this
side having opened it. My response said plainly that I could not assess that
half. This closes that gap for the part an artifact can answer.

**Scope and limits.** This is a compiled, minified standalone file. It supports
findings about what the artifact *declares* and *contains*. It cannot support
findings about source quality, test coverage, or the 453-test claim — those need
the source archive the playbook asks Cowork for, and nothing here should be read
as a substitute for it. No Heavyweight Circuit code, markup, styling or asset
has been copied into this repository, and none should be.

## Identity of the file inspected

| | |
|---|---|
| Filename | `heavyweightcircuitv1.1.0.html` |
| Size | 1,667,118 bytes |
| SHA-256 | `d1a6a59b98b36954f82c1f92fa61507620602597bdbc572bed19e41b5f5f845e` |
| Title element | `Heavyweight Circuit` |
| Engine | Phaser 3 (bundled), same as TEN COUNT |

The playbook records SHA-256
`74bf288b5de562a293d635b1dce872ad47afd2ec9cee8d63d4aaebc37c7f91bf` for the
earlier supplied build. This is a different file, as expected for a later
version.

## Confirmed: build stamping exists

Cowork's claimed post-review fix is real and verifiable from the artifact alone.
The bundle embeds:

```
commit:   "319ce2e4dd34"
builtAt:  "2026-08-02T05:11:47+00:00"
lockfile: "144d2111c93e2450"
version:  "1.0.0"
```

with a defensive fallback when the stamp is absent
(`{commit: "dev", builtAt: "unbuilt", lockfile: "dev", version: "0.0.0-dev"}`)
and a display formatter of the shape `` `v${version} · ${commit} · …` ``, so the
identity is surfaced rather than merely stored.

That is four of the six fields this project's own manifest carries, arrived at
independently, including the lockfile digest. The review treated Cowork's
engineering claims as credible but unverified; on this specific claim the
artifact verifies itself.

## Defect: the artifact's version disagrees with its filename

**The embedded manifest declares `version: "1.0.0"`. The file is named
`v1.1.0`. The string `1.1.0` does not appear anywhere in the artifact.**

So the build cannot tell you which release it is. Only the filename can, and a
filename is not provenance — it is the one piece of metadata that survives no
copy, no download and no rename.

This is the same class of defect this repository hit at commit `f11d4d6`, where
a release candidate was stamped with a PR merge commit that no ordinary clone
could resolve. In both cases the manifest looked complete and the provenance it
recorded was unusable. It is worth naming the pattern rather than the instance:
**identity fields fail quietly, because nothing downstream validates them.**

Suggested fix, in Cowork's lane: source `version` from the same place the
release name comes from — `package.json`, read at build time — rather than a
constant that has to be remembered separately. This repository does that
(`vite.config.ts` reads `pkg.version`), which is why its version cannot drift
from the package it was built from.

Two smaller observations in the same area:

- **No artifact hash.** The playbook's §2 item 5 and Appendix A both call for
  the artifact SHA-256. A single-file build genuinely cannot contain its own
  digest, so this needs a sidecar `build-manifest.json` beside the HTML rather
  than a field inside it. Not a criticism of the design so much as a gap the
  single-file format forces.
- **No dirty flag.** Nothing in the artifact says whether the tree was clean.
  This project learned the hard way that the flag is only meaningful if its
  scope is also recorded (D-031).

## Note for anyone auditing this artifact

A naive substring scan of the bundle reports one hit for `sega`. It is a false
positive: Phaser's SVG path code contains `createSVGPathSegArcAbs`. This
project's release audit hit the identical false positive and fixed it with
word-boundary matching; the same fix applies to any audit run over any
Phaser-bundling artifact, including this one. Flagged so that nobody reports it
as a rights finding.

There is no occurrence of the historical work's names or marks — `holyfield`,
`evander`, `real deal`, `mega drive` all return zero.

## What this inspection does not establish

Everything the playbook actually cares about most:

- Whether Heavyweight Circuit's presentation is better, and in what specific,
  implementable ways. That needs the screen-by-screen experience audit with
  screenshots, timings and copy keys that the playbook asks Cowork to produce —
  it is a design comparison, not something a grep over a minified bundle
  can settle.
- Whether the 453-test claim holds. Needs the source archive.
- Whether either build is more fun. Needs players.

The Code lane's position is unchanged: EHRDB is the *provisional* integration
host because it is the only inspectable source, not because this inspection
settled a comparison. It did not, and could not.
