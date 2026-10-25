import XCTest

// Cross-app UI driver for the already installed Cricket QA app. No game target,
// launch arguments, source changes, save injection or authentication automation.
// Run ONE named test at a time, never while the owner is entering credentials.
final class DeviceRecoveryTests: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "com.coverdrive.cricket")

  override func setUpWithError() throws {
    continueAfterFailure = false
    // Activate the installed game; do not cold-launch, reset or reinstall it.
    app.activate()
    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 15))
  }

  private func control(_ label: String) -> XCUIElement {
    let exact = app.descendants(matching: .any).matching(identifier: label).firstMatch
    if exact.exists { return exact }
    // Observed native RN menu labels include the two icon glyphs, e.g.
    // "<icon>, Login, <icon>". Only these known menu items get this fallback;
    // never substring-match Play against Player, or an arbitrary account action.
    if ["New Game", "Saved Games", "Login", "Settings"].contains(label) {
      return app.descendants(matching: .any).matching(
        NSPredicate(format: "label CONTAINS %@", ", \(label),")
      ).firstMatch
    }
    return exact
  }

  private func tap(_ label: String) {
    XCTAssertTrue(["Login", "Go back", "Saved Games", "Manager", "Player", "Sign out",
      "Backup now / recover careers"].contains(label), "Action outside recovery-driver allowlist")
    let element = control(label)
    XCTAssertTrue(element.waitForExistence(timeout: 10), "Missing game control: \(label)")
    for _ in 0..<3 {
      if element.isHittable { break }
      XCTAssertTrue(app.scrollViews.firstMatch.exists)
      app.scrollViews.firstMatch.swipeUp()
    }
    XCTAssertTrue(element.isHittable, "Game control is not visible: \(label)")
    element.tap()
  }

  private func captureGame(_ name: String) {
    XCTAssertEqual(app.state, .runningForeground)
    let shot = XCTAttachment(screenshot: app.screenshot())
    shot.name = name
    shot.lifetime = .keepAlways
    add(shot)
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = name + "-game-accessibility"
    tree.lifetime = .keepAlways
    add(tree)
  }

  // App-only diagnostic; run only outside private authentication/payment input.
  func testCaptureCurrentGameScreen() {
    captureGame("current-game-screen")
  }

  // Responsiveness diagnosis only: five navigation round trips, one physical
  // coordinate tap per action, no retry taps, scrolling or setting changes.
  // XCTest command/quiescence and snapshot overhead are included in timings;
  // they are NOT direct JS/UI-thread latency or a manual-touch certification.
  func testMainMenuSingleTapNavigation() {
    // Native accessibility exposes the rendered uppercase AUDIO heading.
    let audioHeading = app.staticTexts.matching(NSPredicate(format: "label ==[c] %@", "Audio")).firstMatch
    // A failed diagnostic can leave Settings open. Return once from that
    // positively identified screen only; never dismiss unknown UI or retry.
    if audioHeading.exists && control("Go back").isHittable {
      control("Go back").coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
    XCTAssertTrue(control("New Game").waitForExistence(timeout: 10), "Owner must leave the game on its main menu")
    captureGame("single-tap-main-menu-before")

    for round in 1...5 {
      for label in ["Dismiss appearance choice", "Dismiss dialog", "Dismiss energy recovery"] {
        XCTAssertFalse(control(label).exists, "Close popups manually before this test; do not misclassify a covered menu as missed input")
      }
      XCTAssertTrue(app.alerts.count == 0 && app.sheets.count == 0, "A native popup is covering the game")

      let settings = control("Settings")
      XCTAssertTrue(settings.exists && settings.isHittable, "Settings must be visible without auto-scrolling or retries")
      let openStarted = ProcessInfo.processInfo.systemUptime
      settings.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      let settingsOpened = audioHeading.waitForExistence(timeout: 5)
      print("CRICKET_QA_SINGLE_TAP: round=\(round) action=settings observed=\(settingsOpened) commandAndObservationSeconds=\(ProcessInfo.processInfo.systemUptime - openStarted)")
      if !settingsOpened { captureGame("single-tap-settings-not-opened-\(round)") }
      XCTAssertTrue(settingsOpened, "One Settings tap did not open Settings; no retry was issued")

      let back = control("Go back")
      XCTAssertTrue(back.exists && back.isHittable, "Settings back control is not hittable")
      let backStarted = ProcessInfo.processInfo.systemUptime
      back.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      let menuOpened = control("New Game").waitForExistence(timeout: 5)
      print("CRICKET_QA_SINGLE_TAP: round=\(round) action=back observed=\(menuOpened) commandAndObservationSeconds=\(ProcessInfo.processInfo.systemUptime - backStarted)")
      if !menuOpened { captureGame("single-tap-main-menu-not-opened-\(round)") }
      XCTAssertTrue(menuOpened, "One Back tap did not return to the main menu; no retry was issued")
    }
    captureGame("single-tap-main-menu-after")
  }

  // Vary contact duration/location instead of repeating the same ideal center
  // tap. Still app-only navigation: no settings, authentication or career action.
  // These are requested XCTest gesture durations, not measured finger events.
  func testMainMenuShortTapHitAreas() {
    let audioHeading = app.staticTexts.matching(NSPredicate(format: "label ==[c] %@", "Audio")).firstMatch
    if audioHeading.exists && control("Go back").isHittable {
      control("Go back").coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
    XCTAssertTrue(control("New Game").waitForExistence(timeout: 10), "Expected the known main menu, not an unknown screen")
    captureGame("short-tap-menu-before")

    let cases: [(name: String, x: CGFloat, y: CGFloat, duration: TimeInterval, drift: Bool)] = [
      ("center-30ms", 0.5, 0.5, 0.03, false),
      ("label-30ms", 0.25, 0.5, 0.03, false),
      ("icon-30ms", 0.08, 0.5, 0.03, false),
      ("chevron-30ms", 0.94, 0.5, 0.03, false),
      ("top-30ms", 0.5, 0.15, 0.03, false),
      ("bottom-30ms", 0.5, 0.85, 0.03, false),
      ("center-150ms", 0.5, 0.5, 0.15, false),
      ("center-350ms", 0.5, 0.5, 0.35, false),
      ("center-small-drift", 0.5, 0.5, 0.03, true),
    ]
    for item in cases {
      for label in ["Dismiss appearance choice", "Dismiss dialog", "Dismiss energy recovery"] {
        XCTAssertFalse(control(label).exists, "A popup invalidates this hit-area check; no dismissal/retry is automated")
      }
      XCTAssertTrue(app.alerts.count == 0 && app.sheets.count == 0)
      let settings = control("Settings")
      XCTAssertTrue(settings.exists && settings.isHittable)
      let location = settings.coordinate(withNormalizedOffset: CGVector(dx: item.x, dy: item.y))
      if item.drift {
        location.press(forDuration: item.duration,
          thenDragTo: location.withOffset(CGVector(dx: 2, dy: 1)),
          withVelocity: .slow, thenHoldForDuration: 0)
      } else {
        location.press(forDuration: item.duration)
      }
      let opened = audioHeading.waitForExistence(timeout: 5)
      print("CRICKET_QA_SHORT_TAP: case=\(item.name) destinationObserved=\(opened)")
      if !opened { captureGame("short-tap-missed-\(item.name)") }
      XCTAssertTrue(opened, "Settings did not open for \(item.name); no retry issued")
      let back = control("Go back")
      XCTAssertTrue(back.exists && back.isHittable)
      back.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.03)
      let returned = control("New Game").waitForExistence(timeout: 5)
      print("CRICKET_QA_SHORT_TAP: case=\(item.name) backDestinationObserved=\(returned)")
      if !returned { captureGame("short-tap-back-missed-\(item.name)") }
      XCTAssertTrue(returned, "30ms Back did not return for \(item.name); no retry issued")
    }
    captureGame("short-tap-menu-after")
  }

  // Post-update preservation check. No provider buttons, backup request,
  // settings changes, career opening or gameplay. Finish on the main menu.
  func testVerifyInputDiagnosticInstall() {
    let badge = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^Input QA [234].*")).firstMatch
    XCTAssertTrue(badge.waitForExistence(timeout: 15), "Diagnostic build badge is absent")
    let audioHeading = app.staticTexts.matching(NSPredicate(format: "label ==[c] %@", "Audio")).firstMatch
    if audioHeading.exists && control("Go back").isHittable {
      control("Go back").coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }
    XCTAssertTrue(control("New Game").waitForExistence(timeout: 10))
    let settings = control("Settings")
    XCTAssertTrue(settings.isHittable)
    settings.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    XCTAssertTrue(audioHeading.waitForExistence(timeout: 5))
    XCTAssertTrue(badge.exists)
    control("Go back").coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    XCTAssertTrue(control("New Game").waitForExistence(timeout: 5))

    showAccount()
    XCTAssertFalse(app.staticTexts["Guest profile"].exists, "Existing Google session was not observed")
    XCTAssertTrue(control("Backup now / recover careers").waitForExistence(timeout: 15))
    XCTAssertTrue(control("Sign out").exists, "Expected the existing authenticated session; do not initiate sign-in")
    print("CRICKET_QA_INPUT_UPDATE: authenticated session observed; no sign-out or provider action")
    tap("Go back")
    tap("Saved Games")
    let firstSlot = app.staticTexts.matching(NSPredicate(format: "label ==[c] %@", "Slot 1")).firstMatch
    XCTAssertTrue(firstSlot.waitForExistence(timeout: 15))
    let playerCount = app.buttons.matching(identifier: "Play").count
    print("CRICKET_QA_INPUT_UPDATE_PLAYER_SLOTS: \(playerCount)")
    XCTAssertEqual(playerCount, 5, "Player list differs from the observed pre-update baseline; do not create/replace saves")
    tap("Manager")
    XCTAssertTrue(firstSlot.waitForExistence(timeout: 15))
    let managerCount = app.buttons.matching(identifier: "Play").count
    print("CRICKET_QA_INPUT_UPDATE_MANAGER_SLOTS: \(managerCount)")
    XCTAssertEqual(managerCount, 4, "Manager list differs from the observed pre-update baseline; do not create/replace saves")
    tap("Go back")
    XCTAssertTrue(control("New Game").waitForExistence(timeout: 10))
    XCTAssertTrue(badge.waitForExistence(timeout: 5))
    captureGame("input-diagnostic-installed-preserved-main-menu")
  }

  // One read-only listing pass. No Play/Delete/New/Retry, auth, backup request
  // or settings changes. CPU stage timings come from the local game logger;
  // XCTest elapsed times below contain automation overhead, not input latency.
  func testSavedGamesLoadAndReturnDiagnostic() {
    let badge = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^Input QA [34].*")).firstMatch
    XCTAssertTrue(badge.waitForExistence(timeout: 15))
    XCTAssertTrue(control("New Game").waitForExistence(timeout: 15), "Start on main menu; do not navigate blindly")
    for label in ["Dismiss appearance choice", "Dismiss dialog", "Dismiss energy recovery"] {
      XCTAssertFalse(control(label).exists, "A popup covers the game; stop")
    }
    // Match the icon-delimited MENU item, never a retained screen heading.
    let saved = app.descendants(matching: .any).matching(
      NSPredicate(format: "label CONTAINS %@", ", Saved Games,")
    ).firstMatch
    XCTAssertTrue(saved.isHittable)
    let began = ProcessInfo.processInfo.systemUptime
    saved.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    let slot = app.staticTexts.matching(NSPredicate(format: "label ==[c] %@", "Slot 1")).firstMatch
    let loaded = slot.waitForExistence(timeout: 45)
    print("CRICKET_QA_SAVED_GAMES: playerListObserved=\(loaded) commandAndObservationSeconds=\(ProcessInfo.processInfo.systemUptime - began)")
    if !loaded { captureGame("input-qa3-saved-games-not-loaded") }
    XCTAssertTrue(loaded, "Player list did not appear; no retry or save mutation")
    print("CRICKET_QA_SAVED_GAMES: playerPlayControls=\(app.buttons.matching(identifier: "Play").count)")
    let back = control("Go back")
    XCTAssertTrue(back.isHittable)
    back.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    XCTAssertTrue(control("New Game").waitForExistence(timeout: 20))
    captureGame("input-qa3-saved-games-returned-menu")
  }

  // Observe, do not redefine the old exact-count preservation assertion. A
  // separately synced new cloud career must never be deleted to match a test.
  func testInspectPostUpdateCareerLists() {
    XCTAssertTrue(app.staticTexts["Saved Games"].firstMatch.waitForExistence(timeout: 10))
    let slot = app.staticTexts.matching(NSPredicate(format: "label ==[c] %@", "Slot 1")).firstMatch
    XCTAssertTrue(slot.waitForExistence(timeout: 30))
    let player = app.buttons.matching(identifier: "Play").count
    XCTAssertTrue((1...6).contains(player))
    print("CRICKET_QA_CURRENT_PLAYER_LIST: \(player)")
    captureGame("post-update-player-list")
    tap("Manager")
    XCTAssertTrue(slot.waitForExistence(timeout: 30))
    let manager = app.buttons.matching(identifier: "Play").count
    XCTAssertTrue((1...6).contains(manager))
    print("CRICKET_QA_CURRENT_MANAGER_LIST: \(manager)")
    captureGame("post-update-manager-list")
    tap("Go back")
    XCTAssertTrue(control("New Game").waitForExistence(timeout: 10))
    captureGame("post-update-list-inspection-menu")
  }

  private func showAccount() {
    if app.staticTexts["Saved Games"].firstMatch.exists { tap("Go back") }
    if !app.staticTexts["Account"].firstMatch.exists {
      tap("Login")
    }
    XCTAssertTrue(app.staticTexts["Account"].firstMatch.waitForExistence(timeout: 10))
  }

  // Stops BEFORE Google / Apple authentication. Owner alone handles that flow.
  func testOpenAccountForOwnerSignIn() {
    XCTAssertTrue(control("New Game").waitForExistence(timeout: 15))
    captureGame("main-menu-before-sign-in")
    showAccount()
    let existing = control("Sign in to existing Google account")
    let signedOut = control("Continue with Google")
    XCTAssertTrue(existing.exists || signedOut.exists, "Expected a signed-out or guest account; do not sign out an unexpected account automatically")
    captureGame("account-ready-for-owner-sign-in")
    print("CRICKET_QA_OWNER_ACTION: Google sign-in is ready; no provider button was tapped.")
  }

  // Select only after the owner confirms that Google authentication has ended.
  // This check observes status and save lists, but does not trigger a backup.
  func testInspectRecoveryAndSavedGames() {
    showAccount()
    XCTAssertFalse(app.staticTexts["Guest profile"].exists, "Owner Google sign-in is still needed")
    let backup = control("Backup now / recover careers")
    XCTAssertTrue(backup.waitForExistence(timeout: 15), "No authenticated career backup control")
    let confirmed = app.staticTexts["Account backup confirmed. Remaining balances and original ad-free expiry are saved."].firstMatch
    let empty = app.staticTexts["No careers on this account to back up yet."].firstMatch
    XCTAssertTrue(confirmed.waitForExistence(timeout: 15) || empty.exists, "Recovery has not reached a confirmed result")
    print("CRICKET_QA_OBSERVED_BACKUP_STATUS: \(confirmed.exists ? "confirmed" : "no-cloud-careers")")
    captureGame("account-after-owner-sign-in")
    tap("Go back")
    tap("Saved Games")
    XCTAssertTrue(app.staticTexts["Saved Games"].firstMatch.waitForExistence(timeout: 10))
    // Native labels follow the rendered uppercase textTransform, not JSX case.
    let firstSlot = app.staticTexts.matching(NSPredicate(format: "label ==[c] %@", "Slot 1")).firstMatch
    XCTAssertTrue(firstSlot.waitForExistence(timeout: 15))
    print("CRICKET_QA_PLAYER_SLOT_COUNT: \(app.buttons.matching(identifier: "Play").count)")
    captureGame("restored-player-slots")
    tap("Manager")
    XCTAssertTrue(firstSlot.waitForExistence(timeout: 15))
    print("CRICKET_QA_MANAGER_SLOT_COUNT: \(app.buttons.matching(identifier: "Play").count)")
    captureGame("restored-manager-slots")
    tap("Player")
    print("CRICKET_QA_OBSERVED: Saved Games opened in both modes; screenshots retained in ignored local results. No career opened or changed.")
  }

  // Manual retry requested by the owner. No new/replace/delete or store action.
  func testRetryAccountRecoveryOnce() {
    showAccount()
    XCTAssertFalse(app.staticTexts["Guest profile"].exists)
    tap("Backup now / recover careers")
    let confirmed = app.staticTexts["Account backup confirmed. Remaining balances and original ad-free expiry are saved."]
    let empty = app.staticTexts["No careers on this account to back up yet."]
    let settled = NSPredicate { _, _ in confirmed.exists || empty.exists }
    let outcome = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: settled, object: nil)], timeout: 45)
    captureGame("manual-recovery-retry-result")
    XCTAssertEqual(outcome, .completed, "Recovery was not confirmed; inspect the game error, do not claim a pass")
    print("CRICKET_QA_RECOVERY_STATUS: \(confirmed.exists ? "confirmed" : "no-cloud-careers")")
  }

  // Owner explicitly requested Apple sign-in testing. Sign out only of the
  // GAME after confirmed Google backup; never touch device/iCloud settings.
  // Stop before the provider button so no test records private authentication.
  func testPrepareAppleSignIn() {
    showAccount()
    let confirmed = app.staticTexts["Account backup confirmed. Remaining balances and original ad-free expiry are saved."].firstMatch
    XCTAssertTrue(confirmed.waitForExistence(timeout: 15), "Confirm Google backup before account switching")
    tap("Sign out")
    XCTAssertTrue(app.staticTexts["Signed out. Your local saves are untouched."].firstMatch.waitForExistence(timeout: 10))
    XCTAssertTrue(control("Continue with Apple").waitForExistence(timeout: 10))
    captureGame("apple-sign-in-ready-after-game-only-sign-out")
    print("CRICKET_QA_OWNER_ACTION: Continue with Apple is ready. Game-only sign-out completed; no local careers deleted or provider button tapped.")
  }

  // Run only after the owner confirms the Apple browser flow has finished.
  // A different verified identity must NOT be assumed to own Google careers.
  func testInspectAppleSignIn() {
    showAccount()
    XCTAssertTrue(app.staticTexts["Signed in with Apple."].firstMatch.waitForExistence(timeout: 15), "Apple success was not observed; inspect the app error rather than claiming a pass")
    XCTAssertTrue(control("Sign out").exists)
    XCTAssertFalse(control("Continue with Apple").exists)
    captureGame("apple-sign-in-result")
    let confirmed = app.staticTexts["Account backup confirmed. Remaining balances and original ad-free expiry are saved."].firstMatch
    let ownership = app.staticTexts["Some careers need recovery, belong to another account, or could not fit into empty slots. Your local saves were not overwritten. Keep the app installed."].firstMatch
    print("CRICKET_QA_APPLE_BACKUP_STATE: \(confirmed.exists ? "confirmed" : ownership.exists ? "ownership-or-recovery-warning" : "not-classified")")
    print("CRICKET_QA_APPLE_SIGN_IN: App explicitly confirms Apple sign-in. No account linking, deletion, purchase or career creation performed by test.")
  }
}
