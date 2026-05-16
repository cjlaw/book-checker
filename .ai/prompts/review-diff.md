# Diff Maintainer Review

Review the current diff like a senior maintainer responsible for long-term stability.

## Path Resolution

Treat the current working directory as the project repository root.

All project-local paths below are relative to that repository root:

- Review standard: `.ai/code_review.md`
- Review state: `.ai/reviews/current.md`

Do not use files from the global prompt/template repository as the project review state.

If `.ai/code_review.md` does not exist, continue using the review criteria in this prompt and note the missing review standard under `Unknowns / Gaps`.

If `.ai/reviews/current.md` does not exist, create it.

## Standards

- Follow the project-local `.ai/code_review.md` as the review standard when present.
- Read project-local `.ai/reviews/current.md` before starting, if it exists.
- Overwrite project-local `.ai/reviews/current.md` with the final review findings.

## Context

- The code may have been generated or modified by another AI agent.
- Assume intent may be correct, but implementation may be flawed.

## Scope

- Review ONLY the current diff / PR.
- Use surrounding code only to understand the diff.
- Do NOT audit unrelated parts of the repository.
- Do NOT speculate about unseen code or behavior.

## Constraints

- Only make claims traceable to the diff or inspected surrounding context.
- If a risk depends on code not inspected, mark it as `Potential risk — needs verification`.
- Prioritize actionable, high-signal issues.
- Do NOT report cosmetic/style-only issues.
- Do NOT modify application/source files.
- Prefer minimal fixes over rewrites.

## Review Focus

Review in this order:

1. Correctness
   - Logic errors
   - Edge cases
   - Null/undefined handling
   - Invalid assumptions about state, inputs, or data shape
   - Broken invariants introduced by the change

2. Regressions
   - Behavior changes from the previous implementation
   - Backward compatibility issues
   - API, contract, schema, or data format changes
   - Silent failures or changed error semantics

3. Safety & Reliability
   - Missing validation
   - Error handling gaps
   - Auth/permission issues
   - Data integrity risks
   - Concurrency issues, if applicable

4. Performance
   - Obvious inefficiencies introduced by the change
   - N+1 behavior
   - Repeated expensive work
   - Avoidable I/O or recomputation

5. Tests
   - Missing tests for changed behavior
   - Weak assertions
   - Missing edge case coverage
   - Brittle or flaky test changes

6. Architecture
   - Only report architecture issues when they introduce correctness, reliability, or maintenance risk.
   - Use existing repository patterns as the baseline.

## Process

1. Read project-local `.ai/code_review.md`, if present.
2. Read project-local `.ai/reviews/current.md`, if present.
3. Inspect the current diff.
4. Inspect surrounding code only as needed to understand the changed behavior.
5. Identify behavior added, removed, or changed.
6. Review the diff against the focus areas above.
7. Write the final findings to project-local `.ai/reviews/current.md`, overwriting the file.

## Output Format

Write only the review result to `.ai/reviews/current.md`.

Group findings by severity:

- Critical
- High
- Medium
- Low

For each finding, include:

- **File/Location**
- **Category**: Correctness / Regression / Safety / Performance / Tests / Architecture
- **Issue**
- **Why it matters**
- **When it breaks**
- **Suggested fix**

Also include:

## Potential Risks — Needs Verification

List risks that require broader repo context or runtime validation.

## Unknowns / Gaps

List relevant areas that could not be confidently assessed from the diff.

## If No Major Issues Are Found

Explicitly state that no major issues were found, then list remaining risks or unknowns.
