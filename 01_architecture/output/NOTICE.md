# Attribution

Portions of this architecture — the document-ingestion parser pattern, the
extraction-manifest/provenance model, the operator approval gate, the
markdown-native agent-prompt convention, and the `workflows.json` preset
format — are adapted from:

**CRE Acquisition Orchestrator**
https://github.com/ahacker-1/cre-acquisition-orchestrator
Copyright (c) the CRE Acquisition Orchestrator contributors.
Licensed under the Apache License, Version 2.0:
http://www.apache.org/licenses/LICENSE-2.0

The `agents/ingestion/rent-roll-parser.md` prompt in this folder is a
derivative of that project's `agents/ingestion/rent-roll-parser.md`
(header-mapping tables, normalization rules, and validation rules adapted;
output contract rewritten for the CRE Northstar extraction manifest).

If substantial code (not just patterns) is later lifted from the upstream
repository, carry this NOTICE into the product repo and keep it current.
