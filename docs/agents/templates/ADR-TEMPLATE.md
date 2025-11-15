# ADR-XXX: [Decision Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded
**Deciders**: [Who made this decision - e.g., "User + Claude Code"]
**Tags**: [e.g., architecture, data, frontend, deployment]

---

## Context

**What is the issue we're facing?**

[Describe the problem, challenge, or opportunity that requires a decision. Include relevant background information, constraints, and forces at play.]

**Example:**
> The SANTA project needs to manage company data across multiple domains (frontend, database, geocoding, deployment). A single generalist AI assistant becomes overwhelmed when juggling all these concerns, leading to inconsistent approaches and context loss.

**Forces:**
- [Force 1 - e.g., Limited context window for AI assistants]
- [Force 2 - e.g., Need for specialized expertise in different domains]
- [Force 3 - e.g., Solo developer workflow requires automation]

---

## Decision

**What did we decide?**

[State the decision clearly and concisely. Be specific about what will be done.]

**Example:**
> We will implement a specialized agent system with 8 domain-specific agents, each with clear responsibilities and decision criteria (PASS/REVIEW/FAIL).

**Key aspects:**
- [Aspect 1 - e.g., Each agent has a template with YAML frontmatter]
- [Aspect 2 - e.g., Agents delegate to other agents for specialized tasks]
- [Aspect 3 - e.g., Use Haiku for fast tasks, Sonnet for reasoning]

---

## Consequences

### Positive ✅

- [Good outcome 1 - e.g., Clear separation of concerns improves focus]
- [Good outcome 2 - e.g., Easier context recovery with specialized agents]
- [Good outcome 3 - e.g., Model optimization (Haiku vs Sonnet) reduces cost]

### Negative ❌

- [Trade-off 1 - e.g., Initial overhead creating agent templates]
- [Trade-off 2 - e.g., User needs to learn which agent to invoke]
- [Trade-off 3 - e.g., Coordination complexity between agents]

### Neutral ⚪

- [Side effect 1 - e.g., Documentation burden (but automated by Comet)]
- [Side effect 2 - e.g., Not enforced - user can still work without agents]

---

## Alternatives Considered

### Alternative 1: [Name - e.g., Single Generalist Agent]

**Description:**
[Brief description of this alternative]

**Pros:**
- [Pro 1]
- [Pro 2]

**Cons:**
- [Con 1]
- [Con 2]

**Why rejected:**
[Clear explanation of why this option wasn't chosen]

### Alternative 2: [Name - e.g., Micro-Agents (20+ tiny agents)]

**Description:**
[Brief description of this alternative]

**Pros:**
- [Pro 1]
- [Pro 2]

**Cons:**
- [Con 1]
- [Con 2]

**Why rejected:**
[Clear explanation of why this option wasn't chosen]

### Alternative 3: [Name - e.g., No Agent System]

**Description:**
[Brief description of this alternative]

**Pros:**
- [Pro 1]
- [Pro 2]

**Cons:**
- [Con 1]
- [Con 2]

**Why rejected:**
[Clear explanation of why this option wasn't chosen]

---

## Implementation

**How will this decision be implemented?**

**Immediate actions:**
1. [Step 1 - e.g., Create agent template directory structure]
2. [Step 2 - e.g., Define YAML frontmatter schema]
3. [Step 3 - e.g., Build first agent (Rudolf) and test]

**Timeline:**
- Phase 1: [Timeframe - e.g., Day 1 - Create 3 core agents]
- Phase 2: [Timeframe - e.g., Day 2 - Create remaining agents]
- Phase 3: [Timeframe - e.g., Day 3 - Test and refine]

**Success criteria:**
- [Criterion 1 - e.g., All agents created and tested]
- [Criterion 2 - e.g., User can successfully invoke agents]
- [Criterion 3 - e.g., Documentation stays current automatically]

---

## Related Decisions

- [ADR-XXX: Related decision title](./YYYY-MM-DD-related-decision.md)
- [ADR-XXX: Another related decision](./YYYY-MM-DD-another-decision.md)

---

## References

- [Link to external resource 1]
- [Link to external resource 2]
- [Link to relevant code/docs]

**Example:**
- [llm-distillery project](https://github.com/example/llm-distillery) - Inspiration for agent system
- `docs/agents/AI_AUGMENTED_WORKFLOW.md` - Implementation details
- `docs/agents/SESSION_STATE.md` - Current project status

---

## Notes

[Any additional context, open questions, or future considerations]

**Open questions:**
- [Question 1 - e.g., Should we add more agents in the future?]
- [Question 2 - e.g., How do we handle agent conflicts?]

**Future considerations:**
- [Consideration 1 - e.g., May need to consolidate if too complex]
- [Consideration 2 - e.g., Consider visual diagram of agent relationships]

---

## Review History

| Date | Reviewer | Action | Notes |
|------|----------|--------|-------|
| YYYY-MM-DD | Name | Created | Initial draft |
| YYYY-MM-DD | Name | Accepted | Approved for implementation |
| YYYY-MM-DD | Name | Updated | Clarified consequences section |

---

**Last Updated**: YYYY-MM-DD
**Version**: 1.0
