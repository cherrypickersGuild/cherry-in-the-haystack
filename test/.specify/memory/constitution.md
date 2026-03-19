# <!--

# SYNC IMPACT REPORT - Constitution Update

Version Change: [none] → 1.0.0
Type: MAJOR (Initial constitution establishment)
Date: 2025-11-07

Modified Principles:

- NEW: I. Test-First Development (TDD Mandatory)
- NEW: II. Independent Testability
- NEW: III. Observability & Debuggability
- NEW: IV. Simplicity First (YAGNI)
- NEW: V. Clear Scope & Documentation

Added Sections:

- Core Principles (5 principles)
- Development Workflow
- Quality Standards
- Governance

Removed Sections:

- None (initial version)

Templates Consistency Check:
✅ plan-template.md - Constitution Check section aligns (line 30-34)
✅ spec-template.md - User Scenarios mandatory section aligns with Principle II
✅ tasks-template.md - Test-first task ordering aligns with Principle I

Command Files Check:
✅ All commands reference constitution generically (no agent-specific updates needed)

Follow-up TODOs:

- None (all placeholders filled)

Rationale for v1.0.0:

- This is the initial establishment of project governance
- Defines foundational non-negotiable principles
- Sets baseline for all future development work
- # MAJOR version appropriate for first constitution
  -->

# Cherry-in-the-Haystack Constitution

## Core Principles

### I. Test-First Development (TDD Mandatory)

**NON-NEGOTIABLE**: All implementation work MUST follow Test-Driven Development.

Tests must be written BEFORE implementation and must FAIL before code is written. The
red-green-refactor cycle is strictly enforced:

1. Write tests that capture requirements and acceptance criteria
2. Verify tests FAIL (proving they test the right thing)
3. Implement minimum code to make tests pass
4. Refactor while keeping tests green

**Rationale**: Test-first development ensures requirements are understood before coding
begins, prevents scope creep, provides living documentation, and enables confident
refactoring. Tests written after implementation often validate what was built rather
than what was needed.

**Exceptions**: Exploratory prototypes and research spikes may defer tests, but MUST be
clearly marked as temporary and replaced with TDD approach before merging to main branch.

### II. Independent Testability

Every feature, user story, and component MUST be independently testable and deliverable.

Each user story must represent a complete vertical slice of functionality that:

- Can be implemented without requiring other stories to be complete
- Can be tested in isolation with clear acceptance criteria
- Delivers tangible value to users on its own
- Can be demonstrated as a standalone capability

**Rationale**: Independent testability enables incremental delivery, parallel development,
easier debugging, and true MVP (Minimum Viable Product) thinking. It prevents artificial
dependencies and ensures each piece of work has clear boundaries and value.

**Application**: Feature specifications must prioritize user stories (P1, P2, P3) where
P1 alone constitutes a viable MVP. Task plans must organize work by user story with
clear checkpoints for independent validation.

### III. Observability & Debuggability

All systems MUST be observable, debuggable, and maintainable through clear instrumentation.

Required observability practices:

- **Structured logging**: All significant operations must emit structured logs with
  context (timestamps, identifiers, operation names, outcomes)
- **Text I/O protocol**: CLI tools must use stdin/stdout for data, stderr for errors,
  supporting both JSON and human-readable formats
- **Error transparency**: Errors must include actionable context (what failed, why,
  what to do next)
- **Traceability**: Operations must be traceable through systems with correlation IDs
  or similar mechanisms

**Rationale**: Systems fail in production. Observable systems reduce mean time to
recovery (MTTR) by making diagnosis straightforward. Text-based protocols enable
debugging with standard tools (pipes, grep, logs).

**Application**: Code reviews must verify logging adequacy. Integration tests should
validate error messages provide sufficient context for diagnosis.

### IV. Simplicity First (YAGNI)

Start with the simplest solution that solves the immediate problem. Complexity must be
justified.

**YAGNI Principle**: "You Aren't Gonna Need It" - do not add functionality or
abstraction until there is a concrete, current need.

Complexity requires explicit justification:

- **When adding abstraction**: Document the concrete duplication or variation driving
  the need
- **When adding patterns**: Explain why simpler alternatives (direct implementation,
  functions, modules) are insufficient
- **When adding dependencies**: Justify why existing capabilities cannot solve the
  problem

**Rationale**: Premature complexity creates maintenance burden, steeper learning curves,
and harder debugging. Simple code is easier to understand, test, modify, and delete.
Complexity should emerge from real requirements, not anticipated needs.

**Application**: Code reviews must challenge unnecessary complexity. The Complexity
Tracking section in implementation plans must justify any deviations from simplicity.

### V. Clear Scope & Documentation

Every feature, component, and decision must have clear scope and purpose documented.

Documentation requirements:

- **Feature specifications**: Must define user scenarios, requirements, success criteria
- **Implementation plans**: Must specify structure, constraints, complexity
  justifications
- **Task definitions**: Must include exact file paths, acceptance criteria, dependencies
- **Code**: Must include purpose-explaining comments for non-obvious logic
- **Decisions**: Architectural decisions must document alternatives considered and
  rationale

**Rationale**: Clear documentation enables asynchronous collaboration, onboarding,
maintenance, and informed decision-making. Undocumented systems become maintenance
nightmares and accumulate technical debt.

**Application**: Pull requests without updated documentation must be rejected.
Specifications must be approved before implementation begins.

## Development Workflow

### Specification-First Process

1. **Feature specification** (`spec.md`): Define user stories, requirements, success
   criteria
2. **User approval**: Confirm specification meets needs before design
3. **Implementation planning** (`plan.md`): Research, design, structure, contracts
4. **Task generation** (`tasks.md`): Break down into dependency-ordered, independently
   testable tasks
5. **Test-first implementation**: Write tests, verify failure, implement, verify pass
6. **Validation**: Test against acceptance criteria from specification
7. **Documentation**: Update quickstart, API docs, architecture docs as needed

### Code Review Requirements

All pull requests MUST verify:

- ✅ Tests written before implementation (review git history or ask)
- ✅ All tests passing (CI/CD gates)
- ✅ Each user story independently testable
- ✅ Observability: appropriate logging and error handling present
- ✅ Simplicity: no unjustified complexity or premature abstraction
- ✅ Documentation: updated specs, plans, comments, user-facing docs
- ✅ Constitution compliance: no violations of core principles

## Quality Standards

### Testing Requirements

When tests are included in a feature (optional unless specified), they must meet these
standards:

- **Contract tests**: Verify interface contracts (APIs, function signatures, schemas)
- **Integration tests**: Verify user journeys and component interactions
- **Unit tests**: Verify isolated component behavior (when justified)

Test quality criteria:

- Tests must be deterministic (no flakiness)
- Tests must be fast enough to run in development loop
- Tests must have clear failure messages indicating what broke
- Tests must not require manual setup beyond documented prerequisites

### Performance Standards

Performance requirements are feature-specific and must be defined in specifications:

- Latency requirements (e.g., p95 < 200ms)
- Throughput requirements (e.g., 1000 req/s)
- Resource constraints (e.g., < 100MB memory)
- Scale expectations (e.g., 10k concurrent users)

**Rationale**: Performance requirements vary by domain (web API vs. data processing vs.
mobile app). Specifications must define measurable success criteria appropriate to the
feature.

### Security Requirements

All features must consider security implications:

- **Input validation**: Validate and sanitize all external input
- **OWASP Top 10**: Address applicable vulnerabilities (injection, XSS, auth, etc.)
- **Secrets management**: Never commit credentials, API keys, or secrets
- **Least privilege**: Components should have minimum necessary permissions
- **Security review**: High-risk features require explicit security review

## Governance

### Amendment Process

1. **Proposal**: Document proposed change with rationale and impact assessment
2. **Review**: Project stakeholders review and provide feedback
3. **Approval**: Changes require explicit approval from project maintainers
4. **Version bump**: Follow semantic versioning (MAJOR.MINOR.PATCH)
5. **Migration plan**: If changes affect existing work, document migration approach
6. **Template updates**: Update all dependent templates and command files to maintain
   consistency
7. **Communication**: Announce changes to all project contributors

### Versioning Policy

Constitution versions follow semantic versioning:

- **MAJOR**: Backward-incompatible changes (principle removal, redefinition, policy
  removal)
- **MINOR**: Backward-compatible additions (new principles, expanded guidance, new
  sections)
- **PATCH**: Clarifications, wording improvements, typo fixes, non-semantic refinements

### Compliance Review

Constitution compliance is verified at multiple stages:

- **Pre-implementation**: Implementation plans must include Constitution Check section
- **Implementation**: Each task should verify relevant principles during execution
- **Code review**: Pull requests must confirm compliance with all principles
- **Retrospectives**: Periodic reviews to assess adherence and identify needed
  amendments

### Complexity Justification

When deviating from Principle IV (Simplicity First), explicit justification is required
in the implementation plan's Complexity Tracking section:

| Violation             | Why Needed              | Simpler Alternative Rejected Because |
| --------------------- | ----------------------- | ------------------------------------ |
| [Pattern/abstraction] | [Specific current need] | [Why simpler approach insufficient]  |

Unjustified complexity found during review must be simplified before approval.

---

**Version**: 1.0.0 | **Ratified**: 2025-11-07 | **Last Amended**: 2025-11-07
