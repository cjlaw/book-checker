Perform a repository-wide code review like a senior maintainer performing a periodic audit.

## Path Resolution

Treat the current working directory as the project repository root.

All project-local paths below are relative to that repository root:

- Review standard: `.ai/code_review.md`
- Review state: `.ai/reviews/current.md`

Do not use files from the global prompt/template repository as the project review state.

## Standards

- Follow the project-local `.ai/code_review.md` as the review standard.
- Read project-local `.ai/reviews/current.md` before starting, if it exists.
- Overwrite project-local `.ai/reviews/current.md` with the final review findings.
- If `.ai/reviews/current.md` does not exist, create it.

## Scope

- Review the entire current repository, not just the current diff.
- Focus on high-risk areas first:
  - Core flows
  - Entry points
  - Shared utilities
  - Public APIs
  - Auth/permissions
  - Data handling
  - Persistence
  - Background jobs
  - External service boundaries
  - Tests
- Do NOT modify application/source files.
- Do NOT report cosmetic/style-only issues.

## Constraints

- Only make claims traceable to inspected code.
- Do NOT infer behavior across files unless explicitly verified.
- If uncertain, mark it as `Unknown` or `Potential risk — needs verification`.
- Prioritize actionable, high-signal issues.
- Prefer systemic patterns over isolated instances.
- If multiple instances exist, show 1–2 representative examples.
- Avoid broad rewrite recommendations unless the current design creates concrete risk.

## Process

1. Read project-local `.ai/code_review.md`.
2. Read project-local `.ai/reviews/current.md`, if present.
3. Map the repository:
   - Identify entry points.
   - Identify core modules and shared utilities.
   - Identify data flow boundaries.
   - Identify persistence boundaries.
   - Identify auth/permission boundaries.
   - Identify test structure and coverage patterns.
4. Identify the highest-risk areas.
5. Deep-review those areas for correctness, regressions, safety, architecture, performance, and tests.
6. Identify systemic or repeated patterns.
7. Write the final findings to project-local `.ai/reviews/current.md`, overwriting the file.

## Output Format

Write only the review result to `.ai/reviews/current.md`.

Include these sections:

# Summary

- Highest-risk areas reviewed
- Overall risk level
- Major themes

# Systemic Issues

Cross-cutting issues affecting multiple areas.

# Findings

Group findings by severity:

- Critical
- High
- Medium
- Low

For each finding, include:

- **File/Location** or representative locations
- **Category**: Correctness / Regression / Safety / Architecture / Performance / Tests
- **Issue**
- **Why it matters**
- **When it breaks**
- **Suggested fix**

# Unknowns / Gaps

List areas not confidently reviewed, areas requiring runtime validation, or parts of the repository that need deeper inspection.

# If No Major Issues Are Found

Explicitly state that no major issues were found, then list residual risks and unknowns.
