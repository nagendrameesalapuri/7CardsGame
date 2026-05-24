import {
  trackHoldReleased,
  isHoldCooldownActive,
  _resetHoldExploitTracker,
} from "../socket/handlers/roomHandler";

jest.useFakeTimers();

describe("Hold exploit tracker", () => {
  beforeEach(() => {
    _resetHoldExploitTracker();
    jest.setSystemTime(Date.now());
  });

  test("debounces duplicate immediate releases and applies cooldown after threshold", () => {
    const user = "user1";

    // First release — should not flag
    let r1 = trackHoldReleased(user);
    expect(r1.flagged).toBe(false);
    expect(isHoldCooldownActive(user)).toBe(false);

    // Duplicate within 1s — should be debounced (ignored)
    jest.advanceTimersByTime(1000);
    let r2 = trackHoldReleased(user);
    expect(r2.flagged).toBe(false);
    expect(isHoldCooldownActive(user)).toBe(false);

    // Another real release after >2s — counts as second
    jest.advanceTimersByTime(2500);
    let r3 = trackHoldReleased(user);
    expect(r3.flagged).toBe(false);

    // Fourth release to hit threshold (MAX_RELEASES_IN_WINDOW = 3)
    jest.advanceTimersByTime(2500);
    let r4 = trackHoldReleased(user);

    // r4 should flag cooldown (3 releases within window)
    expect(r4.flagged).toBe(true);
    expect(isHoldCooldownActive(user)).toBe(true);
  });
});
