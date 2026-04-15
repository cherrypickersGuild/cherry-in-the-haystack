# Notion Database Schema: Source Candidates

This document defines the Notion database structure for the staging queue in the source discovery workflow.

## Database: Source Candidates

**Purpose:** Staging queue for discovered sources awaiting human review

### Properties

| Property | Type | Options | Description |
|----------|------|---------|-------------|
| Name | Title | - | Source name |
| URL | URL | - | Source URL or feed URL |
| Type | Select | RSS, TWITTER, YOUTUBE | REDDIT | BLOG | Source type |
| Status | Select | New, Under Review | Approved | Rejected | Review status |
| Auto Score | Number | - | Agent's initial score (1-5) |
| Priority | Select | High | Medium | Low | Review priority |
| Topics | Multi-select | AI Safety, ML Research, AI Governance | Data Science | Topic tags |
| Reason | Rich Text | - | Why this source was suggested |
| Sample Content | Rich Text | - | Recent content sample (titles) |
| Metadata JSON | Rich Text | - | JSON: subscriber count, frequency, etc. |
| Discovered At | Date | - | When discovered |
| Discovered By | Select | Scheduled | Manual | CLI | Web UI | Discovery method |
| Reviewed By | Person | - | Who reviewed (if applicable) |
| Review Notes | Rich Text | - | Human notes |
| Final Score | Select | 1 | 2 | 3 | 4 | 5 | Human's final score |
| Approved At | Date | - | When approved |
| Rejected At | Date | - | When rejected |
| Rejection Reason | Rich Text | - | Why rejected |

### Views to Create

1. **New Candidates** - Status = New, sorted by Auto Score desc
2. **High Priority** - Priority = High, Status = New
3. **Under Review** - Status = Under Review
4. **Approved (Pending Sync)** - Status = Approved
5. **Recently Rejected** - Status = Rejected, Rejected At within 7 days

### Automation Rules

1. **Auto-set Priority:**
   - Auto Score >= 4.0 → Priority = "High"
   - Auto Score 3.0-3.9 → Priority = "Medium"
   - Auto Score < 3.0 → Priority = "Low"

2. **Status Transitions:**
   ```
   New → Under Review (human starts review)
   New → Approved (human approves)
   New → Rejected (human rejects)
   Under Review → Approved
   Under Review → Rejected
   Approved → (removed after sync to Sources DB)
   Rejected → (archived after 30 days)
   ```

3. **Default Sort:**
   - Primary: Priority (High > Medium > Low)
   - Secondary: Discovered At (newest first)

## Database: Sources (Existing)
The "Sources" database already exists and is separate from "Source Candidates".
Approved candidates are copied here after human review.
