# Security Specification — Divertópolis Caixa (Firestore)

## 1. Data Invariants
1. **Strict Document IDs**: Every document ID in `comandas_boliche`, `comandas_aeb`, `fechamentos_historico`, `status_caixa`, and `turno_ativo` must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
2. **Schema & Key Enforcement (`hasAll` / `hasOnly`)**: No shadow or undeclared fields are allowed in any collection (`comandas_boliche`, `comandas_aeb`, `fechamentos_historico`, `status_caixa`, `turno_ativo`).
3. **Volumetric String Boundaries**: All string fields (`id`, `comanda`, `data`, `hora`, `tipo_venda`, `item`, `responsavel`, `status`, `observacao`, `turno`) enforce `.size()` bounds to prevent Denial-of-Wallet payload exhaustion.
4. **Single Active Shift Document**: `status_caixa` and `turno_ativo` only permit the fixed document ID `'atual'`.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection on `comandas_boliche`**: `{ ..., "isAdmin": true }` -> Rejected by `hasOnly()`.
2. **Oversized Document ID (>128 chars)**: `comandas_boliche/{1000-char-id}` -> Rejected by `isValidId()`.
3. **Invalid Characters in Document ID**: `comandas_boliche/bad$id` -> Rejected by `isValidId()`.
4. **Negative Price on Active Sale**: `{ ..., "preco": -50 }` -> Rejected by `data.preco >= 0`.
5. **Invalid `tipo_venda` Enum**: `{ ..., "tipo_venda": "Invalido" }` -> Rejected by enum check `('Boliche' || 'Fichas')`.
6. **Oversized Item Description (>300 chars)**: `{ ..., "item": "<500 chars>" }` -> Rejected by `data.item.size() <= 300`.
7. **Missing Required Field in `comandas_aeb`**: Missing `hora` -> Rejected by `hasAll()`.
8. **Type Poisoning in `fechamentos_historico`**: `diferencaPrata: "zero"` (string instead of number) -> Rejected by `is number`.
9. **Unauthorized Document ID in `status_caixa`**: `status_caixa/outro_doc` -> Rejected by `docId == 'atual'`.
10. **Negative Initial Token Count in `status_caixa/atual`**: `inicialPrata: -10` -> Rejected by `data.inicialPrata >= 0`.
11. **Unmapped Root Collection Write**: `/random_collection/doc1` -> Rejected by global default-deny `match /{document=**} { allow read, write: if false; }`.
12. **Immutable ID Mutation on Update**: Updating `id` field of an existing `comandas_boliche` document -> Rejected by `incoming().id == existing().id`.
