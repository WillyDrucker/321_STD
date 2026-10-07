---
name: aidocs-update-cadence
description: SESSION, MEMORY, BACKLOG, and CHANGELOG are written only by a /321 -Update or -AutoPush pass, never ad hoc after a change. WDDOCS are different and move with the work.
metadata:
  type: feedback
---

Do not run the engine (staging plus `commit --skill updatesession|updatememory`) after ordinary work. SESSION, MEMORY, BACKLOG, and the CHANGELOG get their lines when the user invokes `/321 -Update` or an AutoPush, which capture the whole pass at once. WDDOCS (design elements, feature docs, onboarding, the shape docs) are cataloged as the standards are established, so those edits ride with the code change.

**Why:** the user's ruling: the session, memory, and changelog are updated during an Update or AutoPush, not otherwise, and WDDOCS are different. The -Update pass derives Current State from measurement and folds the arc in one place. Ad hoc engine commits duplicate that work and stack partial LIFO events.

**How to apply:** after a change, update the WDDOCS lines the change falsifies and stop. Leave AIDOCS and the CHANGELOG for the pass. If a fact must survive to the next session before a pass runs, put it in the Compact block, not in SESSION. See [[feedback-lean-docs]].
