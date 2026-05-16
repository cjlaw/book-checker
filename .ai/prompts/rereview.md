# Re-review After Fixes

Re-review the current code after fixes have been applied.

## Path Resolution

Treat the current working directory as the project repository root.

All project-local paths below are relative to that repository root:

- Review standard: `.ai/code_review.md`
- Previous/current review state: `.ai/reviews/current.md`

Do not use files from the global prompt/template repository as the project review state.

If `.ai/code_review.md` does not exist, continue using the review criteria in this prompt and note the missing review standard under `Unknowns / Gaps`.

If `.ai/reviews/current.md` does not exist or is empty, stop and report that there are no previous findings to re-review. Do not perform a fresh full review unless explicitly asked.

## Standards

- Follow the project-local `.ai/code_review.md` as the review standard when present.
- Read previous findings from project-local `.ai/reviews/current.md`.
- Overwrite project-local `.ai/reviews/current.md` with only remaining and new findings.

## Context

- Previous review findings are in `.ai/reviews/current.md`.
- The code has been updated to address those findings.
- The goal is to verify fixes, not restart the entire review from scratch.

## Scope

- Compare the current code against the previous findings in `.ai/reviews/current.md`.
- Verify whether each previous issue is resolved, partially resolved, or still present.
- Review the applied fixes for regressions.
- Do NOT repeat issues that are clearly fixed.
- Do NOT audit the entire repository unless needed to verify a previous finding or fix.
- Do NOT modify application/source files.

## Constraints

- Only make claims based on inspected code.
- Be strict about whether fixes address root causes.
- Do NOT accept superficial fixes that only silence the symptom.
- Prioritize correctness, regressions, safety, and tests.
- Report new issues only if:
  - they were introduced by the fixes, or
  - they are high-risk gaps discovered while verifying the fixes.
- Avoid cosmetic/style-only feedback.
- Prefer minimal fixes over rewrites.

## Review Focus

1. Resolution status
   - Which previous issues are fully resolved?
   - Which are partially resolved?
   - Which still exist?

2. Fix quality
   - Did the fix address the root cause?
   - Did it preserve existing behavior?
   - Did it introduce new edge cases?

3. Regressions
   - New correctness bugs
   - Changed API or data contracts
   - Changed error semantics
   - New performance or reliability risks

4. Test adequacy
   - Were appropriate tests added or updated?
   - Do tests cover the original failure scenario?
   - Are assertions strong enough?

5. Severity changes
   - Should any remaining issue be upgraded or downgraded?

## Process

1. Read project-local `.ai/code_review.md`, if present.
2. Read previous findings from project-local `.ai/reviews/current.md`.
3. For each previous finding:
   - Locate the relevant code.
   - Determine status: `Resolved`, `Partially resolved`, or `Still present`.
   - Verify whether the fix addresses the root cause.
   - Check whether the fix introduces regressions.
4. Inspect nearby or related code only as needed to verify the fix.
5. Identify any new high-risk issues introduced by the fixes.
6. Overwrite project-local `.ai/reviews/current.md` with only remaining and new findings.

## Output Format

Write only the re-review result to `.ai/reviews/current.md`.

Include these sections:

# Summary

- Resolved issues
- Partially resolved issues
- Remaining issues
- New issues
- Severity changes, if any

# Findings

Group only remaining and new issues by severity:

- Critical
- High
- Medium
- Low

For each finding, include:

- **File/Location**
- **Status**: Partially resolved / Still present / New
- **Category**: Correctness / Regression / Safety / Performance / Tests / Architecture
- **Issue**
- **Why it matters**
- **When it breaks**
- **Suggested fix**

# Unknowns / Gaps

List anything that could not be confidently verified.

# If All Issues Are Resolved

Explicitly state that all previous issues appear resolved, then list any remaining risks or unknowns.
