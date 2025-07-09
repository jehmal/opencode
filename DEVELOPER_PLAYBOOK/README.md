# 🎯 DGMO Developer Playbook

> **Transform debugging nightmares into 10-minute victories.** This playbook contains battle-tested solutions discovered through real implementation struggles, not theoretical knowledge.

## 📚 What's Inside

### 🔧 [CHECKPOINT_DEBUGGING_TUTORIAL.md](./CHECKPOINT_DEBUGGING_TUTORIAL.md)

The complete war story of implementing DGMO's checkpoint system, transforming a 2-hour debugging session into a systematic guide covering architecture understanding, implementation patterns, debugging methodology, common pitfalls, and testing strategies—essentially everything you need to implement similar features without the trial and error we endured.

### 🫧 [BUBBLE_TEA_DIALOG_PATTERN.md](./BUBBLE_TEA_DIALOG_PATTERN.md)

The critical Bubble Tea pattern that cost us hours to discover: dialogs with async data loading MUST have their Init() method called explicitly, complete with the golden rule, implementation examples, common variations, and a debugging checklist that will save you from staring at "Loading..." forever.

## 🚀 Why This Playbook Exists

Traditional documentation tells you what's possible. This playbook tells you what went wrong, why it went wrong, and exactly how to fix it. Every pattern here was discovered through actual debugging sessions, making this the documentation we wish we had.

## 💡 How to Use This Playbook

1. **Starting a new feature?** Check if similar patterns exist here first
2. **Something not working?** Follow our debugging methodologies
3. **Seeing weird behavior?** Check the common pitfalls sections
4. **Need quick verification?** Use the command references

## 🎨 The Creative Approach

Instead of dry technical docs, each guide tells a story:

- **The Problem**: What we were trying to build
- **The Journey**: What went wrong (spoiler: a lot)
- **The Discovery**: The "aha!" moment
- **The Solution**: Clean, working code
- **The Wisdom**: Patterns to remember

## 🔑 Key Insights at a Glance

| Pattern            | One-Line Wisdom                                      | Time Saved |
| ------------------ | ---------------------------------------------------- | ---------- |
| Bubble Tea Dialogs | Always call Init() or watch loading screens forever  | ~2 hours   |
| Dynamic Ports      | Pass baseURL through the entire component chain      | ~1 hour    |
| TUI Debugging      | File-based logging > stderr (which you'll never see) | ~30 mins   |
| Server Testing     | Test endpoints directly before blaming the client    | ~45 mins   |

## 🎯 The Ultimate Lesson

> "In Bubble Tea applications, dialog Init() methods must be explicitly called to execute initial commands."

This single line of wisdom would have saved us 2 hours. Now it can save you.

---

_Remember: Great developers aren't those who never debug—they're those who debug once and document for everyone._
