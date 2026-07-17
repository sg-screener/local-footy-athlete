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
  private static let allowedLaunchPurposes = Set([
    "initial-cold-launch",
    "scenario-reset",
    "action-reload",
    "final-step-reload",
    "infrastructure-retry",
    "diagnostic-relaunch",
  ])

  private static var pending: DevE2EPendingLaunchDiagnostic?
  private static var currentReceiptJSON: String?
  private static var currentResolvedMetroUrl: String?

  static func captureAndConfigureIfRequested() {
    pending = nil
    currentReceiptJSON = nil
    currentResolvedMetroUrl = nil
    UserDefaults.standard.removeObject(forKey: receiptDefaultsKey)

    guard let rawURL = UserDefaults.standard.string(forKey: launchArgumentKey)
    else {
      return
    }
    guard
      let launchPurpose = UserDefaults.standard.string(forKey: launchPurposeKey),
      allowedLaunchPurposes.contains(launchPurpose)
    else {
      fatalError("[DevE2E Launch Diagnostic] Invalid or missing launch purpose")
    }
    let metro = validatedMetroURL(rawURL)
    let buildIdentity = loadBuildIdentity()
    guard let bundleIdentifier = Bundle.main.bundleIdentifier,
      !bundleIdentifier.isEmpty
    else {
      fatalError("[DevE2E Launch Diagnostic] App bundle identifier is missing")
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
      fatalError(
        "[DevE2E Metro] Selected server did not resolve a development bundle URL"
      )
    }
    let resolved = validatedMetroURL(bundleURL)
    if let currentResolvedMetroUrl {
      guard currentResolvedMetroUrl == resolved.normalized else {
        fatalError(
          "[DevE2E Launch Diagnostic] Conflicting resolved bundle URLs"
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
      fatalError("[DevE2E Launch Diagnostic] Receipt serialization failed")
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

  private static func loadBuildIdentity() -> DevE2EBuildIdentity {
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
      fatalError(
        "[DevE2E Launch Diagnostic] Debug build identity is missing or invalid"
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
  ) -> (scheme: String, hostPort: String, normalized: String) {
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
      fatalError(
        "[DevE2E Metro] Invalid e2eMetroUrl. " +
          "Expected a canonical local HTTP URL with host and port."
      )
    }
    let hostPort = host.contains(":") ? "[\(host)]:\(port)" : "\(host):\(port)"
    let normalized = "\(scheme)://\(hostPort)"
    guard rawURL == normalized else {
      fatalError("[DevE2E Metro] e2eMetroUrl is not canonical")
    }
    return (scheme, hostPort, normalized)
  }

  private static func validatedMetroURL(
    _ bundleURL: URL
  ) -> (scheme: String, hostPort: String, normalized: String) {
    guard
      let scheme = bundleURL.scheme?.lowercased(),
      scheme == "http",
      let host = bundleURL.host,
      host == "127.0.0.1" || host == "localhost",
      let port = bundleURL.port
    else {
      fatalError(
        "[DevE2E Metro] Resolved development bundle lacks an explicit server"
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
    guard let receiptJSON = DevE2ELaunchDiagnosticReceiptOwner.receiptJSON()
    else {
      return [:]
    }
    return ["receiptJson": receiptJSON]
  }
}
#endif
