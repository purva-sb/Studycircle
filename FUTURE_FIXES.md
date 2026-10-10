# Future Fixes — StudyCircle

Deferred work that is intentionally NOT done yet, with rationale. Each entry records the problem, the current mitigation, the real fix, and the cost of leaving it.

---

## 1. Client opens multiple sockets per user (zombie sockets)

**Status:** Deferred (low priority — symptom already mitigated server-side)
**Area:** Focus Rooms — real-time presence

### Problem
The focus-room page opens **2–3 WebSocket connections per user** instead of one. Render logs showed a single user (`user_3DMj…`) holding 3 sockets (`CWwJ`, `c2Etz`, `_KokF`) connecting/disconnecting within seconds. Root causes: React re-mounts, the async `connect()` racing with effect cleanup, and `user?.id` settling from `undefined` → value, all in the socket `useEffect`.

### Symptom it caused
When one (stale/zombie) socket dropped, the server broadcast `focus:status_change = offline` for that user — so peers saw an actively-studying user stuck on **OFFLINE**, and their tier badges never appeared. (Self always looked fine because self status is local React state, not socket-driven.)

### Current mitigation (already shipped)
Server-side guard `userHasOtherSocketInFocusRoom(...)` in `artifacts/api-server/src/socket.ts` (commit `ca5c3dd`). It only emits `offline` when the user has **no** remaining socket in the room, in both the `disconnect` and `leave_focus_room` handlers. This stops the user-facing bug, but the client still churns sockets underneath.

### The real fix (future)
Make the client hold **exactly one** stable socket per room session:
- Guard the socket `useEffect` so it never creates a second socket while one is alive (e.g., check `socketRef.current` before `io(...)`).
- Ensure cleanup fully disconnects the old socket before any reconnect.
- Settle `user?.id` (and `roomId`) before connecting so the effect doesn't run on a transient `undefined`.

**File:** `artifacts/studycircle/src/pages/focus-room-detail.tsx` — the socket `useEffect` (deps `[roomId, user?.id]`).

### Risk / why deferred
- Touches the **most delicate code** in the file (socket lifecycle). High regression risk.
- The acute symptom is already handled by the server guard, so this is "belt and suspenders," not urgent.
- Zero visual payoff — verified via the browser Network tab / server logs, not the screen.

### Verify the real fix worked
- Network tab shows **one** websocket per room (not 2–3).
- Server logs show no rapid connect/disconnect churn for a single user.
- Two-account test: peers stay FOCUSING with no offline flicker.

### Cost of leaving it unfixed
- **Free Render tier resources:** 2–3× the WebSocket connections = more server memory + heartbeat CPU. On the free tier (limited connections/RAM, spins down on inactivity) this brings you closer to limits and can hasten spin-down under load.
- **Redundant traffic:** every duplicate socket receives the same broadcasts → extra bandwidth and duplicate client-side event handling.
- **Noisy logs:** rapid connect/disconnect spam makes future debugging harder.
- **Latent bugs:** other duplicate-socket issues (double join/leave events, duplicate cards) the server guard does NOT cover could still surface.
