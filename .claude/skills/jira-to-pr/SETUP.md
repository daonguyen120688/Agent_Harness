# jira-to-pr setup

Flow: Jira ticket → `dev-agent` implements and opens PR → `reviewer-agent` reviews → feedback loop (max 3 rounds) → push notification.

## One-time prerequisites

1. **Git repo with a GitHub `origin`.** The workspace root is not a git repo yet; run the workflow from the target project's repo and copy `.claude/agents/` and `.claude/skills/jira-to-pr/` into it (or into `~/.claude/` to use it everywhere).
2. **GitHub CLI:** install `gh` (`winget install GitHub.cli`), then `gh auth login`. Both agents use it for PRs and comments.
3. **Jira access:** authorize the Atlassian connector (`/mcp`, or claude.ai connector settings). Without it, paste the ticket text as the argument.
4. **Notifications:** the orchestrator uses the `PushNotification` tool, so Remote Control or the mobile app must be set up for pushes to reach your phone. Otherwise it falls back to a message in the terminal.

## Run

```
/jira-to-pr ABC-123 main
```

## Design notes

- The skill runs in the main session because subagents cannot spawn subagents; it passes only summaries between agents.
- The reviewer is read-only on code and signals its result with a `REVIEW-VERDICT:` first line, because `gh` cannot request changes on your own PR.
- Safety limits: max 3 review rounds, never merges, never pushes to the base branch, needs explicit AC in the ticket.
- Not yet tested end to end. First run it on a throwaway repo and ticket.
