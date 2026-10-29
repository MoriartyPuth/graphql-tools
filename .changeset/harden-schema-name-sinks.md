---
'@graphql-tools/utils': patch
---

Harden the rebuild containers in `mapSchema`, `extractExtensionsFromSchema` and `rewireTypes` against dangerous object keys: schema member names are now written with `Object.defineProperty` when they match a dangerous key (e.g. `__proto__`, which the GraphQL Name grammar accepts and graphql-js keeps as an own key of its value maps) instead of plain writes that resolve to the inherited setter. A member named like a dangerous key is preserved as an ordinary own property in rebuilt schemas and extracted extensions, instead of hijacking the container's `[[Prototype]]` or disappearing from `Object.keys`-based rebuilds — defense-in-depth parity with the `isDangerousObjectKey` guards in `mergeDeep` / `mergeIncrementalResult`.
