# Pending Backend Fixes — Focus Room

## Fix 2 — Reconnect Grace Period (implement first)

**Problem:** Mobile network blip → server immediately marks user offline → other participants see them disappear then reappear. Studying status is lost, user must tap Start again.

**Solution:** On disconnect, wait 12 seconds before processing. If user reconnects within that window, cancel the pending disconnect — nobody sees anything.

**Implementation in `artifacts/api-server/src/socket.ts`:**

```ts
// Add at top of initSocket, outside connection handler
const pendingDisconnects = new Map<string, ReturnType<typeof setTimeout>>();

// In disconnect handler, replace immediate cleanup with:
socket.on("disconnect", () => {
  // ... existing voice/circle cleanup stays immediate ...

  if (currentFocusRoomId) {
    const roomId = currentFocusRoomId;
    const key = `${authUserId}:${roomId}`;

    const timer = setTimeout(async () => {
      pendingDisconnects.delete(key);
      const mem = store.getFocusRoom(roomId);
      const secs = mem?.participants?.find((p) => p.userId === authUserId)?.totalStudySeconds;
      store.leaveFocusRoom(roomId, authUserId);
      void persistFocusRoomParticipantState(roomId, authUserId, secs ?? 0, "idle");
      io.to(`focus_room_${roomId}`).emit("focus:status_change", { roomId, userId: authUserId, status: "offline" });
      broadcastActiveRooms();
    }, 12_000);

    pendingDisconnects.set(key, timer);
  }
});

// In join_focus_room, cancel grace period if user reconnects:
// Add after socket.join(`focus_room_${roomId}`)
const key = `${authUserId}:${roomId}`;
const pending = pendingDisconnects.get(key);
if (pending) {
  clearTimeout(pending);
  pendingDisconnects.delete(key);
}
```

**Result:** 12s network blip = invisible to other participants. Studying status preserved. No flicker.

---

## Fix 1 — Auto-save Analytics on Crash/Disconnect (implement after Fix 2)

**Problem:** If user force-closes tab, phone dies, or gets kicked — session is never written to analytics. They could study 2 hours and have 0 minutes recorded.

**Solution:** After grace period expires (Fix 2's setTimeout), if user was studying for ≥ 1 min, auto-create a study session entry — same as `confirmLeave` does on the frontend.

**Implementation in `artifacts/api-server/src/socket.ts`:**

Add inside the `setTimeout` callback in Fix 2, after `store.leaveFocusRoom`:

```ts
// Auto-save study session if they studied for at least 1 minute
if (secs && secs >= 60) {
  try {
    const roomRow = await getFocusRoomRow(roomId);
    // Resolve a subjectId — use a fallback if no match
    const subjectId = "s_dsa"; // or look up by room.exam
    await db.insert(studySessionsTable).values({
      userId: authUserId,
      subjectId,
      mode: "stopwatch",
      durationMinutes: Math.max(1, Math.round(secs / 60)),
      note: `Focus Room: "${roomRow?.name ?? roomId}" (auto-saved)`,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error("auto-save study session on disconnect", e);
  }
}
```

**Note:** Need to import `studySessionsTable` from `@workspace/db/schema` and `getFocusRoomRow` from `./lib/focus-room`.

**Result:** No session lost on crash. The "(auto-saved)" note in analytics distinguishes it from a manual end session. Since Fix 2 runs first, quick reconnects cancel the timer and prevent double-counting.

---

## Dependency

Fix 1 depends on Fix 2 being in place. Implement in order: Fix 2 → Fix 1.
