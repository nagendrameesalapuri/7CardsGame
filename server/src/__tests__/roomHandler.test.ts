import {
  trackHoldReleased,
  isHoldCooldownActive,
  _resetHoldExploitTracker,
} from "../socket/handlers/roomHandler";

jest.useFakeTimers();

// MAX_RELEASES_IN_WINDOW is 8 (raised from 3 to allow active players to join many games)
const MAX_RELEASES = 8;

describe("Hold exploit tracker", () => {
  beforeEach(() => {
    _resetHoldExploitTracker();
    jest.setSystemTime(Date.now());
  });

  test("first release does not flag", () => {
    const r = trackHoldReleased("user1");
    expect(r.flagged).toBe(false);
    expect(isHoldCooldownActive("user1")).toBe(false);
  });

  test("releases below threshold do not flag", () => {
    const user = "user2";
    for (let i = 0; i < MAX_RELEASES - 1; i++) {
      jest.advanceTimersByTime(3000);
      const r = trackHoldReleased(user);
      expect(r.flagged).toBe(false);
    }
    expect(isHoldCooldownActive(user)).toBe(false);
  });

  test("reaches threshold and applies cooldown after MAX_RELEASES releases", () => {
    const user = "user3";
    let lastResult: any;
    for (let i = 0; i < MAX_RELEASES; i++) {
      jest.advanceTimersByTime(3000); // space them > debounce window
      lastResult = trackHoldReleased(user);
    }
    // After MAX_RELEASES releases in the window, cooldown should be active
    expect(lastResult.flagged).toBe(true);
    expect(isHoldCooldownActive(user)).toBe(true);
  });

  test("different users do not share state", () => {
    for (let i = 0; i < MAX_RELEASES; i++) {
      jest.advanceTimersByTime(3000);
      trackHoldReleased("heavy-user");
    }
    // Another user starts fresh
    const r = trackHoldReleased("clean-user");
    expect(r.flagged).toBe(false);
    expect(isHoldCooldownActive("clean-user")).toBe(false);
  });
});
