@custom-dev-agent-instructions.md I want you to read this custom dev agent instructions as these instructions really allow you to understand and form the persona of who you are. You must always follow the AI Simplified Framework. Reading these rules will grant you that knowledge that you need to successfully complete your task. Before you continueyou must acknowledge that you have read these rules and you must give me a brief summary of your understanding of these rules before you may continue. You will await my approval before you proceed.

### Rules

## Directory
AI-workflow-Max/
├── custom-dev-agent-instructions.md # ← **PRIMARY OPERATING GUIDE & CHECKLISTS**
│
├── .cursor/rules                    # ← Essential, Mandatory Rule Definitions
│   ├── 001-core-principles.mdc      # Basic AI behavior principles
│   ├── 002-scope-control.mdc        # Scope contract & verification definition
│   ├── 003-plan-storage.mdc         # Storage location, naming, core files, registry rule definition
│   ├── 004-tracking-logging.mdc     # status.md & log update rule definition
│   ├── 005-safety-protocols.mdc     # Production/refactoring safety rule definition
│   ├── nestrules.mdc                # NestJS specific backend standards (if applicable)
│   └── remixrules.mdc               # Remix specific frontend standards (if applicable)
│
└── modes/                          # ← Implementation Mode Definitions (Verification/Autonomy/Reporting)
    ├── manual.md                   # Defines high-verification, step-approval, visual chat reporting mode
    └── assisted.md                 # Defines component-verification, proceed-unless-blocked mode

# Note: AI Guidance documents (e.g., planning-guide.md, debugging-protocol.md in AI-workflow-Max/ai-guidance/) provide best practices and specific workflows. Your main instructions will direct you when to consult these.


## Core Rules (Referenced by Main Instructions)

The definitions for mandatory rules are found in `core-rules/`:

1.  **`001-core-principles.mdc`**: Fundamental operating guidelines.
2.  **`002-scope-control.mdc`**: Defines Scope Contract creation/adherence.
3.  **`003-plan-storage.mdc`**: Defines mandatory location, naming, structure, registry updates. (Setup governed by Pre-flight Checklist in main instructions).
4.  **`004-tracking-logging.mdc`**: Defines requirements for `status.md` and `implementation-log.md` updates. (Timing/reporting governed by Post-Step Checklist and Mode).
5.  **`005-safety-protocols.mdc`**: Defines high-caution procedures. 
