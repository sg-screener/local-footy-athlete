#if DEBUG
import Foundation
import React

private struct DevE2EBuildIdentity {
  let schemaVersion: Int
  let nativeBridgeVersion: String
  let integratedRepositorySha: String
}

private struct DevE2EPendingLaunchDiagnostic {
  let launchPurpose: String
  let requestedMetroUrl: String
  let appBundleIdentifier: String
  let buildIdentity: DevE2EBuildIdentity
}

/**
 * Sole native owner of the development Explorer launch diagnostic receipt.
 * Capture happens before the React factory is created; finalization happens
 * when React Native resolves the actual bundle URL and before JavaScript boots.
 */
enum DevE2ELaunchDiagnosticReceiptOwner {
  static let schemaVersion = 1
  static let nativeBridgeVersion = "1"
  static let receiptDefaultsKey =
    "devE2EExplorerNativeLaunchDiagnosticReceiptV1"

  private static let buildIdentityResource = "DevE2EBuildIdentity"
  private static let launchArgumentKey = "e2eMetroUrl"
  private static let launchPurposeKey = "e2eLaunchPurpose"
  /// THE SEEDING CHANNEL — a first-class launch argument with its own name,
  /// its own validation and its own refusal, beside the two above.
  ///
  /// Sam, 2026-08-10, overruling a cheaper plan: *"i dont care if it has to do
  /// 1 rebuild for 40 minutes - i care about the best solution long term"*.
  ///
  /// WHY IT IS ITS OWN KEY AND NOT A PAYLOAD ON AN EXISTING ONE. Seeding used
  /// to arrive by DEEP LINK, and on iOS that routes through Safari, which
  /// raises "Open in …?" — and a `maestro hierarchy` dump proved that while
  /// that alert is up the accessibility tree holds the alert and ZERO app
  /// content. It does not overlay the app; it replaces what a UI runner can
  /// see. That is what "the rig has been dead since 18 July" actually was.
  ///
  /// Smuggling a seed id into `e2eMetroUrl` would have dodged this rebuild and
  /// put a second meaning on one field — the exact defect class that cost a
  /// pass on 2026-08-10 with the `source` label. Refused deliberately.
  private static let seedIdKey = "e2eSeedId"
  private static let allowedLaunchPurposes = Set([
    "initial-cold-launch",
    "scenario-reset",
    "action-reload",
    "final-step-reload",
    "infrastructure-retry",
    "diagnostic-relaunch",
  ])

  /// Seed ids name authored worlds and are used as path segments, so the shape
  /// is deliberately narrow. Anything else is a typo or an injection attempt,
  /// and both should be loud rather than silently seeding nothing.
  private static let seedIdPattern = "^[a-z0-9][a-z0-9-]{0,63}$"

  private static var validatedSeedId: String?
  private static var pending: DevE2EPendingLaunchDiagnostic?
  private static var currentReceiptJSON: String?
  private static var currentResolvedMetroUrl: String?

  // ───────────────────────────────────────────────────────────────────────────
  // A DEV DIAGNOSTIC MUST NOT BE ABLE TO KILL THE APP.
  //
  // Sam's order, 2026-08-10, after the THIRD crash of this shape in one day:
  // *"A crash is the least debuggable possible signal: it destroys the process
  // before anything can report why."*
  //
  // THE CENSUS THAT ORDER ASKED FOR: this file held TEN hard `fatalError`s on
  // the launch path — lines 81, 95, 102, 120, 127, 164, 207, 234, 242, 257 of
  // the version this replaces. Three of them each cost a debugging cycle:
  //   1. the missing launch purpose — read as "the rig is dead" for 23 days;
  //   2. the resolved-bundle trap behind the reload flows;
  //   3. the Metro URL, which fired when this terminal invoked `maestro test`
  //      without the runner and the app received the LITERAL `${E2E_METRO_URL}`.
  // **Every one of the three was an input mistake outside the app**, and in
  // every case the app died in `didFinishLaunchingWithOptions` — before a line
  // of JavaScript, so nothing could report the reason. The reason had to be
  // reconstructed from `~/Library/Logs/DiagnosticReports` each time.
  //
  // FAIL CLOSED IS KEPT; FAIL DEAD IS NOT. These are different properties and
  // only the second one is being removed. A refusal still stops the diagnostic
  // dead — no receipt is written, no seed id is handed to JS, no Metro override
  // is installed — so a run CANNOT go green having tested an empty world, which
  // is the property `e2eSeedId`'s own comment was protecting. What changes is
  // that the app now BOOTS and SAYS SO: `NSLog` for the human, and a typed
  // refusal over the constants bridge that JS turns into an
  // `e2e-explorer-launch-error-<code>` marker a flow can assert on.
  //
  // **A REFUSAL A FLOW CAN SEE IS STRICTLY MORE THAN A CRASH COULD EVER BE.** A
  // crash tells the runner "the app went away"; it cannot distinguish a bad URL
  // from a bad seed id from a genuine boot defect. A marker names which.
  private static var refusalCodes: [String] = []

  /// Refuse, loudly, and let the app boot. Duplicate codes collapse — one cause
  /// firing twice is one fault, and a flow asserting on the marker wants the
  /// cause, not the count.
  private static func refuse(_ code: String, _ detail: String) {
    NSLog("[DevE2E Refusal] %@: %@", code, detail)
    if !refusalCodes.contains(code) { refusalCodes.append(code) }
  }

  /// `refuse` in expression position, so a `guard … else { return refusing(…) }`
  /// reads as one thought and cannot forget its `return`.
  private static func refusing<T>(_ code: String, _ detail: String) -> T? {
    refuse(code, detail)
    return nil
  }

  /// The refusals raised on this launch, for the constants bridge. Empty is the
  /// normal case and costs the bridge nothing.
  static func launchRefusalCodes() -> [String] { refusalCodes }

  static func captureAndConfigureIfRequested() {
    pending = nil
    currentReceiptJSON = nil
    currentResolvedMetroUrl = nil
    validatedSeedId = nil
    refusalCodes = []
    UserDefaults.standard.removeObject(forKey: receiptDefaultsKey)

    // FAIL CLOSED, exactly like the launch purpose below. A seed id that is
    // present but malformed must never degrade into "no seed" — that is how a
    // run goes green having tested an empty world. `validatedSeedId` stays nil
    // and the refusal is on the record, so JS is handed nothing to seed WITH and
    // the flow's own `e2e-seed-ready-<id>` assertion cannot pass.
    if let rawSeedId = UserDefaults.standard.string(forKey: seedIdKey) {
      guard rawSeedId.range(of: seedIdPattern, options: .regularExpression) != nil
      else {
        refuse("seed-id-malformed", "\(seedIdKey)=\(rawSeedId)")
        return
      }
      validatedSeedId = rawSeedId
      NSLog("[DevE2E Seed] Requested seed: %@", rawSeedId)
    }

    guard let rawURL = UserDefaults.standard.string(forKey: launchArgumentKey)
    else {
      return
    }
    guard
      let launchPurpose = UserDefaults.standard.string(forKey: launchPurposeKey),
      allowedLaunchPurposes.contains(launchPurpose)
    else {
      return refuse(
        "launch-purpose-invalid",
        "\(launchPurposeKey)="
          + (UserDefaults.standard.string(forKey: launchPurposeKey) ?? "<missing>")
      )
    }
    guard let metro = validatedMetroURL(rawURL) else { return }
    guard let buildIdentity = loadBuildIdentity() else { return }
    guard let bundleIdentifier = Bundle.main.bundleIdentifier,
      !bundleIdentifier.isEmpty
    else {
      return refuse("bundle-identifier-missing", "Bundle.main.bundleIdentifier")
    }

    let provider = RCTBundleURLProvider.sharedSettings()
    provider.packagerScheme = metro.scheme
    provider.jsLocation = metro.hostPort
    pending = DevE2EPendingLaunchDiagnostic(
      launchPurpose: launchPurpose,
      requestedMetroUrl: metro.normalized,
      appBundleIdentifier: bundleIdentifier,
      buildIdentity: buildIdentity
    )
    NSLog("[DevE2E Metro] Selected server: %@", metro.normalized)
  }

  static func finalizeResolvedBundle(_ bundleURL: URL?) {
    guard let pending else { return }
    guard let bundleURL else {
      return refuse(
        "bundle-url-unresolved",
        "the selected server did not resolve a development bundle URL"
      )
    }
    guard let resolved = validatedMetroURL(bundleURL) else { return }
    if let currentResolvedMetroUrl {
      guard currentResolvedMetroUrl == resolved.normalized else {
        return refuse(
          "resolved-bundle-conflict",
          "\(currentResolvedMetroUrl) vs \(resolved.normalized)"
        )
      }
      return
    }

    let resolvedBundleFingerprint = fnv1a32(bundleURL.absoluteString)
    let unsignedPayload = canonicalReceiptPayload(
      schemaVersion: schemaVersion,
      nativeBridgeVersion: pending.buildIdentity.nativeBridgeVersion,
      launchPurpose: pending.launchPurpose,
      requestedMetroUrl: pending.requestedMetroUrl,
      resolvedMetroUrl: resolved.normalized,
      resolvedBundleFingerprint: resolvedBundleFingerprint,
      appBundleIdentifier: pending.appBundleIdentifier,
      integratedRepositorySha: pending.buildIdentity.integratedRepositorySha
    )
    let receipt: [String: Any] = [
      "schemaVersion": schemaVersion,
      "nativeBridgeVersion": pending.buildIdentity.nativeBridgeVersion,
      "launchPurpose": pending.launchPurpose,
      "requestedMetroUrl": pending.requestedMetroUrl,
      "resolvedMetroUrl": resolved.normalized,
      "resolvedBundleFingerprint": resolvedBundleFingerprint,
      "appBundleIdentifier": pending.appBundleIdentifier,
      "integratedRepositorySha": pending.buildIdentity.integratedRepositorySha,
      "receiptFingerprint": fnv1a32(unsignedPayload),
    ]
    guard
      JSONSerialization.isValidJSONObject(receipt),
      let data = try? JSONSerialization.data(
        withJSONObject: receipt,
        options: [.sortedKeys]
      ),
      let json = String(data: data, encoding: .utf8)
    else {
      return refuse("receipt-serialization-failed", "JSONSerialization refused the receipt")
    }

    UserDefaults.standard.set(json, forKey: receiptDefaultsKey)
    currentReceiptJSON = json
    currentResolvedMetroUrl = resolved.normalized
    NSLog(
      "[DevE2E Metro] Resolved bundle fingerprint: %@",
      resolvedBundleFingerprint
    )
  }

  static func receiptJSON() -> String? {
    currentReceiptJSON ?? UserDefaults.standard.string(forKey: receiptDefaultsKey)
  }

  /// The validated seed id, or nil when none was requested. Never the raw
  /// argument — a caller that could read the raw value could skip the guard.
  static func requestedSeedId() -> String? { validatedSeedId }

  private static func loadBuildIdentity() -> DevE2EBuildIdentity? {
    guard
      let url = Bundle.main.url(
        forResource: buildIdentityResource,
        withExtension: "plist"
      ),
      let data = try? Data(contentsOf: url),
      let value = try? PropertyListSerialization.propertyList(
        from: data,
        options: [],
        format: nil
      ),
      let dictionary = value as? [String: Any],
      let identitySchemaVersion = dictionary["schemaVersion"] as? Int,
      identitySchemaVersion == schemaVersion,
      let bridgeVersion = dictionary["nativeBridgeVersion"] as? String,
      bridgeVersion == nativeBridgeVersion,
      let repositorySha = dictionary["integratedRepositorySha"] as? String,
      repositorySha.range(
        of: "^[a-f0-9]{40}$",
        options: .regularExpression
      ) != nil
    else {
      return refusing(
        "build-identity-invalid",
        "\(buildIdentityResource).plist is missing or does not match schema "
          + "\(schemaVersion)/bridge \(nativeBridgeVersion)"
      )
    }
    return DevE2EBuildIdentity(
      schemaVersion: identitySchemaVersion,
      nativeBridgeVersion: bridgeVersion,
      integratedRepositorySha: repositorySha
    )
  }

  private static func validatedMetroURL(
    _ rawURL: String
  ) -> (scheme: String, hostPort: String, normalized: String)? {
    guard
      let components = URLComponents(string: rawURL),
      let scheme = components.scheme?.lowercased(),
      scheme == "http",
      let host = components.host,
      host == "127.0.0.1" || host == "localhost",
      let port = components.port,
      components.user == nil,
      components.password == nil,
      components.query == nil,
      components.fragment == nil,
      components.path.isEmpty || components.path == "/"
    else {
      // THE DETAIL CARRIES THE VALUE, AND THAT IS THE WHOLE POINT OF THIS
      // CHANGE. When this fired on 2026-08-10 the value was the LITERAL
      // `${E2E_METRO_URL}` — a runner invoked without `-e`. A crash could not
      // say that; this line says it in the device log and names the code in a
      // marker, and the fix is then obvious rather than archaeological.
      return refusing(
        "metro-url-invalid",
        "\(launchArgumentKey)=\(rawURL) — expected a canonical local HTTP URL "
          + "with host and port, e.g. http://127.0.0.1:8081"
      )
    }
    let hostPort = host.contains(":") ? "[\(host)]:\(port)" : "\(host):\(port)"
    let normalized = "\(scheme)://\(hostPort)"
    guard rawURL == normalized else {
      return refusing(
        "metro-url-not-canonical",
        "\(launchArgumentKey)=\(rawURL), canonical form is \(normalized)"
      )
    }
    return (scheme, hostPort, normalized)
  }

  private static func validatedMetroURL(
    _ bundleURL: URL
  ) -> (scheme: String, hostPort: String, normalized: String)? {
    guard
      let scheme = bundleURL.scheme?.lowercased(),
      scheme == "http",
      let host = bundleURL.host,
      host == "127.0.0.1" || host == "localhost",
      let port = bundleURL.port
    else {
      return refusing(
        "resolved-bundle-server-missing",
        "resolved bundle URL \(bundleURL.absoluteString) lacks an explicit "
          + "local http host and port"
      )
    }
    let hostPort = host.contains(":") ? "[\(host)]:\(port)" : "\(host):\(port)"
    return (scheme, hostPort, "\(scheme)://\(hostPort)")
  }

  private static func canonicalReceiptPayload(
    schemaVersion: Int,
    nativeBridgeVersion: String,
    launchPurpose: String,
    requestedMetroUrl: String,
    resolvedMetroUrl: String,
    resolvedBundleFingerprint: String,
    appBundleIdentifier: String,
    integratedRepositorySha: String
  ) -> String {
    [
      "schemaVersion=\(schemaVersion)",
      "nativeBridgeVersion=\(nativeBridgeVersion)",
      "launchPurpose=\(launchPurpose)",
      "requestedMetroUrl=\(requestedMetroUrl)",
      "resolvedMetroUrl=\(resolvedMetroUrl)",
      "resolvedBundleFingerprint=\(resolvedBundleFingerprint)",
      "appBundleIdentifier=\(appBundleIdentifier)",
      "integratedRepositorySha=\(integratedRepositorySha)",
    ].joined(separator: "\n")
  }

  private static func fnv1a32(_ value: String) -> String {
    var hash: UInt32 = 0x811c9dc5
    for byte in value.utf8 {
      hash = (hash ^ UInt32(byte)) &* 0x01000193
    }
    return String(format: "fnv1a32:%08x", hash)
  }
}

/** Synchronous legacy-module constants bridge; absent from Release builds. */
@objc(DevE2ELaunchDiagnostic)
final class DevE2ELaunchDiagnostic: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc func constantsToExport() -> [AnyHashable: Any] {
    var constants: [AnyHashable: Any] = [:]
    if let receiptJSON = DevE2ELaunchDiagnosticReceiptOwner.receiptJSON() {
      constants["receiptJson"] = receiptJSON
    }
    // THROUGH THIS BRIDGE AND NOT `SettingsManager`. A JS-side attempt to read
    // launch arguments from `NativeModules.SettingsManager.settings` was built
    // on 2026-08-10 and deleted the same day: a probe printed `NO_SETTINGS` —
    // that module is undefined here, so the branch could never have fired.
    // This bridge is the one that demonstrably reaches JS.
    if let seedId = DevE2ELaunchDiagnosticReceiptOwner.requestedSeedId() {
      constants["seedId"] = seedId
    }
    // THE REFUSALS, SO A FLOW CAN SEE WHAT A CRASH USED TO HIDE. Only present
    // when something was refused, so the normal launch carries nothing extra.
    let refusals = DevE2ELaunchDiagnosticReceiptOwner.launchRefusalCodes()
    if !refusals.isEmpty {
      constants["launchRefusalCodes"] = refusals
    }
    return constants
  }
}
#endif
