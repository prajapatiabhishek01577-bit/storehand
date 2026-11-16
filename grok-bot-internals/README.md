# Grok Bot internals

How xAI's Grok Bot actually works under the hood. Reference for building Storehand.

Last checked: 2026-11-15.

## Pages

1. [Computer](computer.md): the cloud machine Bots run on. Specs, isolation, persistence.
2. [Bots and memory](bots-and-memory.md): what a Bot is, the primary Bot, what it remembers.
3. [Request lifecycle](request-lifecycle.md): one request, start to finish.
4. [Apps and tools](apps-and-tools.md): connectors, MCP, Bot email, X search.
5. [Credentials](credentials.md): Vault, 1Password, Secure Forms, human takeover.
6. [Approvals](approvals.md): Auto Review and Custom Rules.
7. [Skills and routines](skills-and-routines.md): reusable instructions and triggers.
8. [Models and platform](models-and-platform.md): model routing, the Cursor backend, billing.

## Sources

Each fact is tagged with where it came from:

- **[observed]**: a Bot reported it from its own machine. See [assets/computer-specs.png](assets/computer-specs.png).
- **[docs]**: xAI's official docs at https://docs.x.ai/grok-bot/overview.

Where the two disagree, the page says so.

## Key takeaways for Storehand

- **One VM per user, not per Bot.** Bots are separate personas and chats on a shared machine.
- **Each Bot gets its own screen.** Parallel computer use. Not a security boundary.
- **Chats live outside the VM.** You can wipe the machine and lose no conversations.
- **Secrets never reach the model.** Logins are filled into the page directly. OAuth tokens stay on the backend.
- **Every action passes a model-based review.** Users add plain-English "Ask first" or "Allow automatically" rules.
- **Skills + routines = automation.** First get the task working, then save it as a skill, then schedule it.
- **The modest box is enough.** 8 vCPU, 15 GB RAM, no GPU. The models run elsewhere.
