import Expo
import React
import ReactAppDependencyProvider

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
#if DEBUG
    DevE2EMetroLaunch.configureIfRequested()
#endif

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

#if DEBUG
private enum DevE2EMetroLaunch {
  private static let launchArgumentKey = "e2eMetroUrl"
  private static let resolvedMetroKey = "e2eResolvedMetroUrl"

  static func configureIfRequested() {
    UserDefaults.standard.removeObject(forKey: resolvedMetroKey)
    guard let rawURL = UserDefaults.standard.string(forKey: launchArgumentKey) else {
      return
    }

    guard
      let components = URLComponents(string: rawURL),
      let scheme = components.scheme?.lowercased(),
      scheme == "http" || scheme == "https",
      let host = components.host,
      !host.isEmpty,
      let port = components.port,
      components.user == nil,
      components.password == nil,
      components.query == nil,
      components.fragment == nil,
      components.path.isEmpty || components.path == "/"
    else {
      fatalError(
        "[DevE2E Metro] Invalid e2eMetroUrl '\(rawURL)'. Expected an explicit http(s) URL with host and port."
      )
    }

    let hostPort = host.contains(":") ? "[\(host)]:\(port)" : "\(host):\(port)"
    let provider = RCTBundleURLProvider.sharedSettings()
    provider.packagerScheme = scheme
    provider.jsLocation = hostPort

    NSLog("[DevE2E Metro] Selected server: %@://%@", scheme, hostPort)
  }

  static func logResolvedBundle(_ bundleURL: URL?) {
    guard UserDefaults.standard.string(forKey: launchArgumentKey) != nil else {
      return
    }
    guard let bundleURL else {
      fatalError("[DevE2E Metro] Selected server did not resolve a development bundle URL")
    }
    guard let scheme = bundleURL.scheme,
      let host = bundleURL.host,
      let port = bundleURL.port
    else {
      fatalError("[DevE2E Metro] Resolved development bundle lacks an explicit server")
    }
    let hostPort = host.contains(":") ? "[\(host)]:\(port)" : "\(host):\(port)"
    UserDefaults.standard.set(
      "\(scheme)://\(hostPort)/",
      forKey: resolvedMetroKey
    )
    NSLog("[DevE2E Metro] Resolved bundle: %@", bundleURL.absoluteString)
  }
}
#endif

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    let bundleURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
    DevE2EMetroLaunch.logResolvedBundle(bundleURL)
    return bundleURL
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
