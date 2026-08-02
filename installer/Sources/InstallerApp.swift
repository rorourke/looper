import AppKit
import Foundation
import QuartzCore

private let looperBundleIdentifier = "com.nickbolton.looper.electron"
private let looperTeamIdentifier = "5ES339A7SN"
private let maximumManifestSize = 16_384
private let maximumArchiveSize: Int64 = 1_073_741_824
private let looperArchitecture: String = {
  #if arch(arm64)
    return "arm64"
  #elseif arch(x86_64)
    return "x86_64"
  #else
    #error("The Looper installer supports only Apple Silicon and Intel Macs.")
  #endif
}()

private enum InstallerError: LocalizedError {
  case appIsRunning
  case archiveIsInvalid
  case destinationIsOccupied
  case downloadIsInvalid
  case downloadIsTooLarge
  case feedIsInvalid
  case installationFailed
  case noInstallationDirectory
  case signatureIsInvalid

  var errorDescription: String? {
    switch self {
    case .appIsRunning:
      return "Looper is still running. Quit it and try again."
    case .archiveIsInvalid:
      return "The downloaded copy of Looper is incomplete. Please try again."
    case .destinationIsOccupied:
      return "Another app named Looper is already in Applications."
    case .downloadIsInvalid:
      return "The Looper download could not be verified. Please try again."
    case .downloadIsTooLarge:
      return "The Looper download is larger than expected."
    case .feedIsInvalid:
      return "The latest Looper version could not be found. Check your connection and try again."
    case .installationFailed:
      return "Looper could not be copied to Applications."
    case .noInstallationDirectory:
      return "Your Applications folder is not writable."
    case .signatureIsInvalid:
      return "The downloaded app is not signed by Looper."
    }
  }
}

private struct ReleaseFeed: Decodable {
  let name: String
  let url: String
}

private struct LooperRelease: Sendable {
  let archiveURL: URL
  let version: String
}

private enum ReleaseClient {
  private static let productionFeedURL = URL(
    string: "https://looper.app/updates/macos/feed?version=0.0.0&arch=\(architecture)"
  )!

  private static var architecture: String {
    #if arch(arm64)
      return "arm64"
    #elseif arch(x86_64)
      return "x64"
    #else
      #error("The Looper installer supports only Apple Silicon and Intel Macs.")
    #endif
  }

  private static var feedURL: URL {
    #if DEBUG_INSTALLER
      if let override = ProcessInfo.processInfo.environment["LOOPER_INSTALLER_FEED_URL"],
        let url = URL(string: override)
      {
        return url
      }
    #endif
    return productionFeedURL
  }

  static func latestRelease() async throws -> LooperRelease {
    let data: Data

    #if DEBUG_INSTALLER
      if feedURL.isFileURL {
        data = try Data(contentsOf: feedURL, options: [.mappedIfSafe])
      } else {
        data = try await fetchManifest()
      }
    #else
      data = try await fetchManifest()
    #endif

    guard data.count <= maximumManifestSize,
      let feed = try? JSONDecoder().decode(ReleaseFeed.self, from: data),
      feed.name.range(
        of: #"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$"#,
        options: .regularExpression
      ) != nil,
      let archiveURL = URL(string: feed.url),
      isAllowedArchiveURL(archiveURL, version: feed.name)
    else {
      throw InstallerError.feedIsInvalid
    }

    return LooperRelease(archiveURL: archiveURL, version: feed.name)
  }

  private static func fetchManifest() async throws -> Data {
    var request = URLRequest(url: feedURL)
    request.cachePolicy = .reloadIgnoringLocalCacheData
    request.timeoutInterval = 30

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse,
      httpResponse.statusCode == 200,
      httpResponse.url?.scheme == "https",
      httpResponse.url?.host == "looper.app",
      data.count <= maximumManifestSize
    else {
      throw InstallerError.feedIsInvalid
    }
    return data
  }

  private static func isAllowedArchiveURL(_ url: URL, version: String) -> Bool {
    #if DEBUG_INSTALLER
      if url.isFileURL {
        return true
      }
    #endif

    guard url.scheme == "https",
      url.user == nil,
      url.password == nil,
      url.fragment == nil,
      let host = url.host,
      host.count > ".public.blob.vercel-storage.com".count,
      host.hasSuffix(".public.blob.vercel-storage.com")
    else {
      return false
    }

    let expectedName = "Looper-\(version)-macOS-\(architecture).zip"
    return url.lastPathComponent == expectedName
      && Set(url.queryItems.map(\.name)).isSubset(of: ["download"])
  }
}

extension URL {
  fileprivate var queryItems: [URLQueryItem] {
    URLComponents(url: self, resolvingAgainstBaseURL: false)?.queryItems ?? []
  }
}

private final class DownloadTaskBox: @unchecked Sendable {
  private let lock = NSLock()
  private var task: URLSessionDownloadTask?
  private var isCancelled = false

  func store(_ task: URLSessionDownloadTask) {
    lock.lock()
    if isCancelled {
      lock.unlock()
      task.cancel()
      return
    }
    self.task = task
    lock.unlock()
  }

  func cancel() {
    lock.lock()
    isCancelled = true
    let task = task
    lock.unlock()
    task?.cancel()
  }

  private var didExceedMaximumSize = false

  func cancelBecauseDownloadIsTooLarge() {
    lock.lock()
    didExceedMaximumSize = true
    let task = task
    lock.unlock()
    task?.cancel()
  }

  var exceededMaximumSize: Bool {
    lock.lock()
    let result = didExceedMaximumSize
    lock.unlock()
    return result
  }
}

private final class ProgressObservationBox: @unchecked Sendable {
  private let lock = NSLock()
  private var observation: NSKeyValueObservation?

  func store(_ observation: NSKeyValueObservation) {
    lock.lock()
    self.observation = observation
    lock.unlock()
  }

  func invalidate() {
    lock.lock()
    let observation = observation
    self.observation = nil
    lock.unlock()
    observation?.invalidate()
  }
}

private enum ArchiveDownloader {
  static func download(
    _ release: LooperRelease,
    into workingDirectory: URL,
    progress: @escaping @MainActor @Sendable (Double) -> Void
  ) async throws -> URL {
    let destination = workingDirectory.appendingPathComponent("Looper-\(release.version).zip")

    #if DEBUG_INSTALLER
      if release.archiveURL.isFileURL {
        try FileManager.default.copyItem(at: release.archiveURL, to: destination)
        await progress(1)
        return destination
      }
    #endif

    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = 60
    configuration.timeoutIntervalForResource = 30 * 60
    configuration.waitsForConnectivity = true
    let session = URLSession(configuration: configuration)
    defer { session.finishTasksAndInvalidate() }

    var request = URLRequest(url: release.archiveURL)
    request.cachePolicy = .reloadIgnoringLocalCacheData
    let response = try await download(
      request,
      using: session,
      to: destination,
      progress: progress
    )

    guard let httpResponse = response as? HTTPURLResponse,
      httpResponse.statusCode == 200,
      httpResponse.url?.scheme == "https",
      let host = httpResponse.url?.host,
      host.hasSuffix(".public.blob.vercel-storage.com")
    else {
      throw InstallerError.downloadIsInvalid
    }

    let declaredLength = httpResponse.expectedContentLength
    if declaredLength > maximumArchiveSize {
      throw InstallerError.downloadIsTooLarge
    }

    let values = try destination.resourceValues(forKeys: [.fileSizeKey])
    guard let fileSize = values.fileSize, fileSize > 0 else {
      throw InstallerError.downloadIsInvalid
    }
    if Int64(fileSize) > maximumArchiveSize {
      throw InstallerError.downloadIsTooLarge
    }

    await progress(1)
    return destination
  }

  private static func download(
    _ request: URLRequest,
    using session: URLSession,
    to destination: URL,
    progress: @escaping @MainActor @Sendable (Double) -> Void
  ) async throws -> URLResponse {
    let taskBox = DownloadTaskBox()
    let observationBox = ProgressObservationBox()

    return try await withTaskCancellationHandler {
      try await withCheckedThrowingContinuation { continuation in
        let task = session.downloadTask(with: request) { temporaryURL, response, error in
          observationBox.invalidate()

          if let error {
            if (error as? URLError)?.code == .cancelled {
              continuation.resume(
                throwing: taskBox.exceededMaximumSize
                  ? InstallerError.downloadIsTooLarge
                  : CancellationError()
              )
            } else {
              continuation.resume(throwing: error)
            }
            return
          }
          guard let temporaryURL, let response else {
            continuation.resume(throwing: InstallerError.downloadIsInvalid)
            return
          }

          do {
            try FileManager.default.moveItem(at: temporaryURL, to: destination)
            continuation.resume(returning: response)
          } catch {
            continuation.resume(throwing: InstallerError.downloadIsInvalid)
          }
        }

        taskBox.store(task)
        observationBox.store(
          task.progress.observe(\.fractionCompleted, options: [.initial, .new]) {
            observedProgress,
            _ in
            if observedProgress.completedUnitCount > maximumArchiveSize {
              taskBox.cancelBecauseDownloadIsTooLarge()
              return
            }
            let fraction = min(1, max(0, observedProgress.fractionCompleted))
            Task { @MainActor in
              progress(fraction)
            }
          }
        )
        task.resume()
      }
    } onCancel: {
      observationBox.invalidate()
      taskBox.cancel()
    }
  }
}

private enum LooperInstaller {
  static var defaultInstallationDirectory: URL {
    let systemApplications = URL(fileURLWithPath: "/Applications", isDirectory: true)
    if FileManager.default.isWritableFile(atPath: systemApplications.path) {
      return systemApplications
    }
    return FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Applications", isDirectory: true)
  }

  static func install(
    release: LooperRelease,
    archiveURL: URL,
    workingDirectory: URL,
    installationDirectory requestedDirectory: URL?
  ) throws -> URL {
    let extractionDirectory = workingDirectory.appendingPathComponent(
      "Extracted",
      isDirectory: true
    )
    try FileManager.default.createDirectory(
      at: extractionDirectory,
      withIntermediateDirectories: true
    )
    try run(
      "/usr/bin/ditto",
      arguments: ["-x", "-k", "--noqtn", archiveURL.path, extractionDirectory.path],
      failure: .archiveIsInvalid
    )

    let appURL = extractionDirectory.appendingPathComponent("Looper.app", isDirectory: true)
    guard isRegularDirectory(appURL) else {
      throw InstallerError.archiveIsInvalid
    }
    try validateRelease(release, at: appURL)
    try verifySignature(of: appURL)

    let applicationsDirectory = try installationDirectory(requestedDirectory)
    let destination = applicationsDirectory.appendingPathComponent(
      "Looper.app",
      isDirectory: true
    )
    try validateExistingDestination(destination)

    let fileManager = FileManager.default
    let nonce = UUID().uuidString
    let incoming = applicationsDirectory.appendingPathComponent(
      ".Looper.installing-\(nonce).app",
      isDirectory: true
    )
    let backup = applicationsDirectory.appendingPathComponent(
      ".Looper.previous-\(nonce).app",
      isDirectory: true
    )

    do {
      try fileManager.copyItem(at: appURL, to: incoming)
      try validateRelease(release, at: incoming)
      try verifySignature(of: incoming)

      if fileManager.fileExists(atPath: destination.path) {
        try fileManager.moveItem(at: destination, to: backup)
      }

      do {
        try fileManager.moveItem(at: incoming, to: destination)
      } catch {
        if fileManager.fileExists(atPath: backup.path),
          !fileManager.fileExists(atPath: destination.path)
        {
          try? fileManager.moveItem(at: backup, to: destination)
        }
        throw error
      }

      if fileManager.fileExists(atPath: backup.path) {
        try fileManager.removeItem(at: backup)
      }
      return destination
    } catch let error as InstallerError {
      try? fileManager.removeItem(at: incoming)
      throw error
    } catch {
      try? fileManager.removeItem(at: incoming)
      throw InstallerError.installationFailed
    }
  }

  private static func installationDirectory(_ requestedDirectory: URL?) throws -> URL {
    #if DEBUG_INSTALLER
      if let override = ProcessInfo.processInfo.environment[
        "LOOPER_INSTALLER_INSTALL_DIRECTORY"
      ] {
        let directory = URL(fileURLWithPath: override, isDirectory: true)
        try FileManager.default.createDirectory(
          at: directory,
          withIntermediateDirectories: true
        )
        return directory
      }
    #endif

    if let requestedDirectory {
      guard requestedDirectory.isFileURL,
        isRegularDirectory(requestedDirectory),
        FileManager.default.isWritableFile(atPath: requestedDirectory.path)
      else {
        throw InstallerError.noInstallationDirectory
      }
      return requestedDirectory
    }

    let defaultDirectory = defaultInstallationDirectory
    do {
      try FileManager.default.createDirectory(
        at: defaultDirectory,
        withIntermediateDirectories: true
      )
      guard FileManager.default.isWritableFile(atPath: defaultDirectory.path) else {
        throw InstallerError.noInstallationDirectory
      }
      return defaultDirectory
    } catch {
      throw InstallerError.noInstallationDirectory
    }
  }

  private static func validateExistingDestination(_ destination: URL) throws {
    guard FileManager.default.fileExists(atPath: destination.path) else {
      return
    }
    guard isRegularDirectory(destination),
      Bundle(url: destination)?.bundleIdentifier == looperBundleIdentifier
    else {
      throw InstallerError.destinationIsOccupied
    }
  }

  private static func isRegularDirectory(_ url: URL) -> Bool {
    guard
      let values = try? url.resourceValues(
        forKeys: [.isDirectoryKey, .isSymbolicLinkKey]
      )
    else {
      return false
    }
    return values.isDirectory == true && values.isSymbolicLink != true
  }

  private static func validateRelease(_ release: LooperRelease, at appURL: URL) throws {
    guard let bundle = Bundle(url: appURL),
      bundle.bundleIdentifier == looperBundleIdentifier,
      bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        == release.version,
      let executableURL = bundle.executableURL
    else {
      throw InstallerError.archiveIsInvalid
    }
    try run(
      "/usr/bin/lipo",
      arguments: ["-verify_arch", looperArchitecture, executableURL.path],
      failure: .archiveIsInvalid
    )
  }

  private static func verifySignature(of appURL: URL) throws {
    #if DEBUG_INSTALLER
      if ProcessInfo.processInfo.environment[
        "LOOPER_INSTALLER_ALLOW_UNSIGNED_FOR_TESTING"
      ] == "1" {
        return
      }
    #endif

    let requirement = """
      anchor apple generic and identifier "\(looperBundleIdentifier)" \
      and certificate leaf[subject.OU] = "\(looperTeamIdentifier)"
      """
    try run(
      "/usr/bin/codesign",
      arguments: [
        "--verify",
        "--deep",
        "--strict",
        "--all-architectures",
        "--test-requirement=\(requirement)",
        appURL.path,
      ],
      failure: .signatureIsInvalid
    )
    try run(
      "/usr/sbin/spctl",
      arguments: ["--assess", "--type", "execute", appURL.path],
      failure: .signatureIsInvalid
    )
  }

  private static func run(
    _ executable: String,
    arguments: [String],
    failure: InstallerError
  ) throws {
    let process = Process()
    let errorPipe = Pipe()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    process.standardOutput = FileHandle.nullDevice
    process.standardError = errorPipe

    do {
      try process.run()
    } catch {
      throw failure
    }
    process.waitUntilExit()
    guard process.terminationStatus == 0 else {
      let details =
        String(
          data: errorPipe.fileHandleForReading.readDataToEndOfFile(),
          encoding: .utf8
        ) ?? ""
      NSLog("%@: %@", failure.localizedDescription, details)
      throw failure
    }
  }
}

@MainActor
private enum InstallerPalette {
  static let darkCanvas = NSColor(
    srgbRed: 39 / 255,
    green: 39 / 255,
    blue: 42 / 255,
    alpha: 1
  )
  static let darkInsetHover = NSColor(
    srgbRed: 13 / 255,
    green: 13 / 255,
    blue: 13 / 255,
    alpha: 1
  )
  static let darkInsetPressed = NSColor(
    srgbRed: 23 / 255,
    green: 23 / 255,
    blue: 23 / 255,
    alpha: 1
  )
  static let lightCanvas = NSColor(
    srgbRed: 236 / 255,
    green: 236 / 255,
    blue: 236 / 255,
    alpha: 1
  )
  static let darkActionBackground = NSColor(
    srgbRed: 245 / 255,
    green: 245 / 255,
    blue: 247 / 255,
    alpha: 1
  )
  static let darkActionForeground = NSColor(
    srgbRed: 23 / 255,
    green: 23 / 255,
    blue: 23 / 255,
    alpha: 1
  )
  static let darkActionPressed = NSColor(
    srgbRed: 222 / 255,
    green: 222 / 255,
    blue: 226 / 255,
    alpha: 1
  )
  static let lightActionBackground = NSColor(
    srgbRed: 29 / 255,
    green: 29 / 255,
    blue: 31 / 255,
    alpha: 1
  )
  static let lightActionPressed = NSColor(
    srgbRed: 52 / 255,
    green: 52 / 255,
    blue: 56 / 255,
    alpha: 1
  )
  static let darkLibraryActionBackground = NSColor(
    srgbRed: 5 / 255,
    green: 5 / 255,
    blue: 5 / 255,
    alpha: 1
  )
  static let darkLibraryActionPressed = NSColor(
    srgbRed: 9 / 255,
    green: 9 / 255,
    blue: 9 / 255,
    alpha: 1
  )
  static let darkLibraryActionHover = NSColor(
    srgbRed: 13 / 255,
    green: 13 / 255,
    blue: 13 / 255,
    alpha: 1
  )
  static let lightLibraryActionBackground = NSColor(
    srgbRed: 252 / 255,
    green: 252 / 255,
    blue: 252 / 255,
    alpha: 1
  )

  static func isDark(_ appearance: NSAppearance) -> Bool {
    appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
  }
}

@MainActor
private final class InstallerBackgroundView: NSView {
  override var isOpaque: Bool { true }
  override var wantsUpdateLayer: Bool { true }

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    wantsLayer = true
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    wantsLayer = true
  }

  override func updateLayer() {
    let backgroundColor =
      InstallerPalette.isDark(effectiveAppearance)
      ? InstallerPalette.darkCanvas
      : InstallerPalette.lightCanvas
    layer?.backgroundColor = backgroundColor.cgColor
  }

  override func viewDidChangeEffectiveAppearance() {
    super.viewDidChangeEffectiveAppearance()
    needsDisplay = true
  }
}

@MainActor
private final class InstallLocationFooter: NSView {
  private let dividerLayer = CALayer()

  override var isOpaque: Bool { false }
  override var wantsUpdateLayer: Bool { true }

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    configureLayer()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    configureLayer()
  }

  override func updateLayer() {
    let isDark = InstallerPalette.isDark(effectiveAppearance)
    layer?.backgroundColor = NSColor.clear.cgColor
    let edgeColor = isDark ? NSColor.white : NSColor.black
    dividerLayer.backgroundColor = edgeColor.withAlphaComponent(0.10).cgColor
  }

  override func layout() {
    super.layout()
    dividerLayer.frame = CGRect(
      x: 0,
      y: bounds.height - 0.5,
      width: bounds.width,
      height: 0.5
    )
  }

  override func viewDidChangeEffectiveAppearance() {
    super.viewDidChangeEffectiveAppearance()
    needsDisplay = true
  }

  private func configureLayer() {
    wantsLayer = true
    layer?.masksToBounds = true
    layer?.addSublayer(dividerLayer)
  }
}

@MainActor
private final class DestinationLinkButton: NSControl {
  weak var destinationLabel: NSTextField?
  weak var chevronView: NSImageView?
  private var hoverTrackingArea: NSTrackingArea?
  private var isHovered = false
  private var isPressed = false

  override var isOpaque: Bool { false }

  override func hitTest(_ point: NSPoint) -> NSView? {
    super.hitTest(point) == nil ? nil : self
  }

  override func updateTrackingAreas() {
    super.updateTrackingAreas()
    if let hoverTrackingArea {
      removeTrackingArea(hoverTrackingArea)
    }
    let trackingArea = NSTrackingArea(
      rect: .zero,
      options: [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect],
      owner: self,
      userInfo: nil
    )
    addTrackingArea(trackingArea)
    hoverTrackingArea = trackingArea
  }

  override func resetCursorRects() {
    super.resetCursorRects()
    if isEnabled {
      addCursorRect(bounds, cursor: .pointingHand)
    }
  }

  override func mouseEntered(with event: NSEvent) {
    setHovered(true)
  }

  override func mouseExited(with event: NSEvent) {
    setHovered(false)
  }

  override func mouseDown(with event: NSEvent) {
    guard isEnabled else { return }
    isPressed = true
    updateDestinationColor()
  }

  override func mouseUp(with event: NSEvent) {
    guard isEnabled else { return }
    isPressed = false
    updateDestinationColor()

    let location = convert(event.locationInWindow, from: nil)
    if bounds.contains(location) {
      sendAction(action, to: target)
    }
  }

  override func viewDidChangeEffectiveAppearance() {
    super.viewDidChangeEffectiveAppearance()
    updateDestinationColor()
  }

  func setInteractionEnabled(_ enabled: Bool) {
    isEnabled = enabled
    if !enabled {
      isHovered = false
      isPressed = false
    }
    updateDestinationColor()
    window?.invalidateCursorRects(for: self)
  }

  private func setHovered(_ hovered: Bool) {
    guard isEnabled, hovered != isHovered else { return }
    isHovered = hovered
    updateDestinationColor()
  }

  private func updateDestinationColor() {
    let isDark = InstallerPalette.isDark(effectiveAppearance)
    let color: NSColor
    if !isEnabled {
      color =
        isDark
        ? NSColor.white.withAlphaComponent(0.35)
        : NSColor.black.withAlphaComponent(0.35)
    } else if isPressed {
      color =
        isDark
        ? NSColor.white.withAlphaComponent(0.65)
        : NSColor.black.withAlphaComponent(0.65)
    } else if isHovered {
      color =
        isDark
        ? NSColor.white
        : InstallerPalette.lightActionBackground
    } else {
      color =
        isDark
        ? NSColor.white.withAlphaComponent(0.50)
        : NSColor.black.withAlphaComponent(0.55)
    }
    destinationLabel?.textColor = color
    chevronView?.contentTintColor = color
  }
}

@MainActor
private final class LibraryActionButton: NSButton {
  private var hoverTrackingArea: NSTrackingArea?
  private var isHovered = false

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    wantsLayer = true
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    wantsLayer = true
  }

  override func updateTrackingAreas() {
    super.updateTrackingAreas()
    if let hoverTrackingArea {
      removeTrackingArea(hoverTrackingArea)
    }
    let trackingArea = NSTrackingArea(
      rect: .zero,
      options: [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect],
      owner: self,
      userInfo: nil
    )
    addTrackingArea(trackingArea)
    hoverTrackingArea = trackingArea
  }

  override func mouseEntered(with event: NSEvent) {
    guard isEnabled else { return }
    isHovered = true
    needsDisplay = true
  }

  override func mouseExited(with event: NSEvent) {
    isHovered = false
    needsDisplay = true
  }

  override func viewDidChangeEffectiveAppearance() {
    super.viewDidChangeEffectiveAppearance()
    needsDisplay = true
  }

  override func draw(_ dirtyRect: NSRect) {
    let isDark = InstallerPalette.isDark(effectiveAppearance)
    let backgroundColor: NSColor
    let titleColor: NSColor
    let edgeColor: NSColor
    let edgeOpacity: CGFloat
    if isDark {
      backgroundColor =
        cell?.isHighlighted == true
        ? InstallerPalette.darkLibraryActionPressed
        : (isHovered
          ? InstallerPalette.darkLibraryActionHover
          : InstallerPalette.darkLibraryActionBackground)
      titleColor = .white
      edgeColor = .white
      edgeOpacity = isHovered ? 0.25 : 0.18
    } else {
      backgroundColor = InstallerPalette.lightLibraryActionBackground
      titleColor = InstallerPalette.lightActionBackground
      edgeColor = .black
      edgeOpacity = isHovered ? 0.20 : 0.12
    }

    updateShadow(isDark: isDark)

    let visualBounds = bounds.insetBy(dx: 0.5, dy: 0.5)
    let buttonPath = NSBezierPath(
      roundedRect: visualBounds,
      xRadius: visualBounds.height / 2,
      yRadius: visualBounds.height / 2
    )
    let opacity: CGFloat
    if !isEnabled {
      opacity = 0.40
    } else {
      opacity = 1
    }
    if !isDark {
      NSGraphicsContext.saveGraphicsState()
      let nearShadow = NSShadow()
      nearShadow.shadowColor = NSColor.black.withAlphaComponent(0.04 * opacity)
      nearShadow.shadowBlurRadius = isHovered ? 2.5 : 1
      nearShadow.shadowOffset = NSSize(width: 0, height: isHovered ? -2 : -1)
      nearShadow.set()
      backgroundColor.withAlphaComponent(opacity).setFill()
      buttonPath.fill()
      NSGraphicsContext.restoreGraphicsState()
    }
    backgroundColor.withAlphaComponent(opacity).setFill()
    buttonPath.fill()
    buttonPath.lineWidth = 1
    edgeColor.withAlphaComponent(edgeOpacity * opacity).setStroke()
    buttonPath.stroke()

    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.alignment = .center
    let attributedTitle = NSAttributedString(
      string: title,
      attributes: [
        .font: font ?? NSFont.systemFont(ofSize: 15, weight: .medium),
        .foregroundColor: titleColor,
        .paragraphStyle: paragraphStyle,
      ]
    )
    let titleHeight = attributedTitle.size().height
    attributedTitle.draw(
      in: NSRect(
        x: 0,
        y: (bounds.height - titleHeight) / 2,
        width: bounds.width,
        height: titleHeight
      )
    )
  }

  private func updateShadow(isDark: Bool) {
    guard let layer else { return }
    let visualBounds = bounds.insetBy(dx: 0.5, dy: 0.5)
    layer.shadowPath = CGPath(
      roundedRect: visualBounds,
      cornerWidth: visualBounds.height / 2,
      cornerHeight: visualBounds.height / 2,
      transform: nil
    )
    layer.shadowColor = NSColor.black.cgColor
    layer.shadowOpacity = isDark ? 0 : (isHovered ? 0.065 : 0.045)
    layer.shadowRadius = isHovered ? 12 : 11
    layer.shadowOffset = CGSize(width: 0, height: isHovered ? -9 : -7)
  }
}

@MainActor
private final class LooperProgressView: NSView {
  private let trackLayer = CALayer()
  private let gradientLayer = CAGradientLayer()
  private let revealMask = CALayer()
  private var isAnimating = false

  override init(frame frameRect: NSRect) {
    super.init(frame: frameRect)
    wantsLayer = true

    trackLayer.backgroundColor = trackColor
    layer?.addSublayer(trackLayer)

    gradientLayer.colors = [
      iconColor(red: 0.78, green: 0.00, blue: 1.00),
      iconColor(red: 0.63, green: 0.02, blue: 1.00),
      iconColor(red: 0.35, green: 0.16, blue: 0.98),
      iconColor(red: 0.21, green: 0.42, blue: 1.00),
      iconColor(red: 0.00, green: 0.62, blue: 0.97),
      iconColor(red: 0.00, green: 0.68, blue: 0.87),
      iconColor(red: 0.00, green: 0.76, blue: 0.67),
    ]
    gradientLayer.locations = [0, 0.18, 0.34, 0.51, 0.68, 0.83, 1]
    gradientLayer.startPoint = CGPoint(x: 0, y: 0.5)
    gradientLayer.endPoint = CGPoint(x: 1, y: 0.5)
    revealMask.backgroundColor = NSColor.white.cgColor
    gradientLayer.mask = revealMask
    layer?.addSublayer(gradientLayer)

    setAccessibilityElement(true)
    setAccessibilityRole(.progressIndicator)
    setAccessibilityLabel("Installing Looper")
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layout() {
    super.layout()

    let lineHeight = min(4, bounds.height)
    let lineFrame = CGRect(
      x: 0,
      y: (bounds.height - lineHeight) / 2,
      width: bounds.width,
      height: lineHeight
    )
    trackLayer.frame = lineFrame
    trackLayer.cornerRadius = lineHeight / 2
    gradientLayer.frame = lineFrame
    gradientLayer.cornerRadius = lineHeight / 2
    gradientLayer.masksToBounds = true

    let segmentWidth = max(54, lineFrame.width * 0.38)
    revealMask.bounds = CGRect(x: 0, y: 0, width: segmentWidth, height: lineHeight)
    revealMask.cornerRadius = lineHeight / 2
    revealMask.position = CGPoint(x: segmentWidth / 2, y: lineHeight / 2)

    if isAnimating && revealMask.animation(forKey: "travel") == nil {
      installTravelAnimation()
    }
  }

  override func viewDidChangeEffectiveAppearance() {
    super.viewDidChangeEffectiveAppearance()
    trackLayer.backgroundColor = trackColor
  }

  func startAnimation() {
    isAnimating = true
    isHidden = false
    layoutSubtreeIfNeeded()
    installTravelAnimation()
  }

  func stopAnimation() {
    isAnimating = false
    revealMask.removeAnimation(forKey: "travel")
  }

  func setProgressPercent(_ percent: Int) {
    setAccessibilityValue(percent)
    setAccessibilityValueDescription("\(percent)%")
  }

  private var trackColor: CGColor {
    let isDark = InstallerPalette.isDark(effectiveAppearance)
    return
      (isDark
      ? NSColor.white.withAlphaComponent(0.25)
      : NSColor.black.withAlphaComponent(0.10)).cgColor
  }

  private func iconColor(red: CGFloat, green: CGFloat, blue: CGFloat) -> CGColor {
    NSColor(
      srgbRed: red,
      green: green,
      blue: blue,
      alpha: 1
    ).cgColor
  }

  private func installTravelAnimation() {
    let segmentWidth = revealMask.bounds.width
    guard bounds.width > segmentWidth else { return }

    revealMask.removeAnimation(forKey: "travel")
    let travel = CABasicAnimation(keyPath: "position.x")
    travel.fromValue = segmentWidth / 2
    travel.toValue = bounds.width - (segmentWidth / 2)
    travel.duration = 1.15
    travel.autoreverses = true
    travel.repeatCount = .infinity
    travel.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
    revealMask.add(travel, forKey: "travel")
  }
}

@MainActor
private final class InstallerWindowController: NSWindowController, NSWindowDelegate {
  private let headerLabel = NSTextField(labelWithString: "Installer")
  private let contentRegion = NSView()
  private let contentGroup = NSView()
  private let iconView = NSImageView()
  private let actionArea = NSView()
  private let readyActionRow = NSView()
  private let progressActionRow = NSView()
  private let installLocationFooter = InstallLocationFooter()
  private let installLocationLabel = NSTextField(labelWithString: "Install location")
  private let destinationButton = DestinationLinkButton()
  private let destinationLabel = NSTextField(labelWithString: "")
  private let destinationChevron = NSImageView()
  private let progressPercentageLabel = NSTextField(labelWithString: "0%")
  private let installButton = LibraryActionButton(
    title: "Install Looper",
    target: nil,
    action: nil
  )
  private let progressView = LooperProgressView()
  private var selectedInstallationDirectory: URL?
  private var installationTask: Task<Void, Never>?
  private var previewProgressTask: Task<Void, Never>?
  private var currentProgress = 0
  private(set) var isPerformingCriticalInstall = false

  private var previewState: String? {
    #if DEBUG_INSTALLER
      return ProcessInfo.processInfo.environment["LOOPER_INSTALLER_PREVIEW_STATE"]
    #else
      return nil
    #endif
  }

  init() {
    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 500, height: 410),
      styleMask: [.titled, .closable, .miniaturizable, .fullSizeContentView],
      backing: .buffered,
      defer: false
    )
    window.title = "Installer"
    window.titleVisibility = .hidden
    window.titlebarAppearsTransparent = true
    window.isMovableByWindowBackground = true
    window.isReleasedWhenClosed = false
    window.center()

    super.init(window: window)
    window.delegate = self
    configureContent()
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func prepareForDisplay() {
    if previewState == "progress" {
      showProgress()
      startPreviewProgress()
    } else {
      showReady()
    }
  }

  func windowShouldClose(_ sender: NSWindow) -> Bool {
    guard !isPerformingCriticalInstall else {
      NSSound.beep()
      return false
    }
    return true
  }

  func windowWillClose(_ notification: Notification) {
    installationTask?.cancel()
    previewProgressTask?.cancel()
    NSApp.terminate(nil)
  }

  private func configureContent() {
    guard let contentView = window?.contentView else { return }

    let background = InstallerBackgroundView()
    background.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(background)

    let headerFont = NSFont.systemFont(ofSize: 13, weight: .semibold)
    headerLabel.alignment = .center
    headerLabel.font = headerFont
    headerLabel.textColor = .labelColor
    headerLabel.translatesAutoresizingMaskIntoConstraints = false

    iconView.image = NSApp.applicationIconImage
    iconView.imageScaling = .scaleProportionallyUpOrDown
    iconView.translatesAutoresizingMaskIntoConstraints = false
    iconView.setContentHuggingPriority(.required, for: .vertical)
    iconView.setAccessibilityElement(false)
    contentRegion.translatesAutoresizingMaskIntoConstraints = false
    contentGroup.translatesAutoresizingMaskIntoConstraints = false
    contentGroup.addSubview(iconView)

    installLocationLabel.font = .systemFont(ofSize: 11, weight: .medium)
    installLocationLabel.textColor = .secondaryLabelColor
    installLocationLabel.translatesAutoresizingMaskIntoConstraints = false
    installLocationLabel.setAccessibilityElement(false)

    destinationLabel.alignment = .right
    destinationLabel.font = .systemFont(ofSize: 12)
    destinationLabel.textColor = .secondaryLabelColor
    destinationLabel.lineBreakMode = .byTruncatingMiddle
    destinationLabel.translatesAutoresizingMaskIntoConstraints = false
    destinationLabel.setAccessibilityElement(false)
    destinationButton.destinationLabel = destinationLabel
    destinationButton.target = self
    destinationButton.action = #selector(destinationButtonPressed)
    destinationButton.translatesAutoresizingMaskIntoConstraints = false
    destinationButton.setAccessibilityElement(true)
    destinationButton.setAccessibilityRole(.button)
    updateDestinationLabel()
    destinationButton.addSubview(destinationLabel)

    destinationChevron.image = NSImage(
      systemSymbolName: "chevron.right",
      accessibilityDescription: nil
    )?.withSymbolConfiguration(
      NSImage.SymbolConfiguration(pointSize: 9, weight: .semibold)
    )
    destinationChevron.imageScaling = .scaleNone
    destinationChevron.translatesAutoresizingMaskIntoConstraints = false
    destinationChevron.setAccessibilityElement(false)
    destinationButton.chevronView = destinationChevron
    destinationButton.addSubview(destinationChevron)

    progressPercentageLabel.alignment = .left
    progressPercentageLabel.font = .systemFont(ofSize: 12, weight: .medium)
    progressPercentageLabel.textColor = .labelColor
    progressPercentageLabel.translatesAutoresizingMaskIntoConstraints = false
    progressPercentageLabel.setAccessibilityElement(false)

    installButton.isBordered = false
    installButton.focusRingType = .none
    installButton.controlSize = .large
    installButton.font = .systemFont(ofSize: 15, weight: .medium)
    installButton.keyEquivalent = "\r"
    installButton.target = self
    installButton.action = #selector(installButtonPressed)
    installButton.translatesAutoresizingMaskIntoConstraints = false
    progressView.translatesAutoresizingMaskIntoConstraints = false

    actionArea.translatesAutoresizingMaskIntoConstraints = false
    readyActionRow.translatesAutoresizingMaskIntoConstraints = false
    progressActionRow.translatesAutoresizingMaskIntoConstraints = false
    readyActionRow.addSubview(installButton)
    progressActionRow.addSubview(progressView)
    actionArea.addSubview(readyActionRow)
    actionArea.addSubview(progressActionRow)
    contentGroup.addSubview(actionArea)
    contentRegion.addSubview(contentGroup)

    installLocationFooter.translatesAutoresizingMaskIntoConstraints = false
    destinationButton.translatesAutoresizingMaskIntoConstraints = false
    installLocationFooter.addSubview(installLocationLabel)
    installLocationFooter.addSubview(destinationButton)
    installLocationFooter.addSubview(progressPercentageLabel)

    background.addSubview(headerLabel)
    background.addSubview(contentRegion)
    background.addSubview(installLocationFooter)

    NSLayoutConstraint.activate([
      background.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      background.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      background.topAnchor.constraint(equalTo: contentView.topAnchor),
      background.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
      headerLabel.centerXAnchor.constraint(equalTo: background.centerXAnchor),
      headerLabel.topAnchor.constraint(equalTo: background.topAnchor, constant: 7),
      contentRegion.leadingAnchor.constraint(equalTo: background.leadingAnchor),
      contentRegion.trailingAnchor.constraint(equalTo: background.trailingAnchor),
      contentRegion.topAnchor.constraint(equalTo: background.topAnchor, constant: 30),
      contentRegion.bottomAnchor.constraint(equalTo: installLocationFooter.topAnchor),
      contentGroup.centerXAnchor.constraint(equalTo: contentRegion.centerXAnchor),
      contentGroup.centerYAnchor.constraint(equalTo: contentRegion.centerYAnchor, constant: 14),
      contentGroup.widthAnchor.constraint(equalToConstant: 272),
      contentGroup.heightAnchor.constraint(equalToConstant: 182),
      iconView.centerXAnchor.constraint(equalTo: contentGroup.centerXAnchor),
      iconView.topAnchor.constraint(equalTo: contentGroup.topAnchor),
      iconView.widthAnchor.constraint(equalToConstant: 118),
      iconView.heightAnchor.constraint(equalToConstant: 118),
      actionArea.centerXAnchor.constraint(equalTo: contentGroup.centerXAnchor),
      actionArea.topAnchor.constraint(equalTo: iconView.bottomAnchor, constant: 24),
      actionArea.bottomAnchor.constraint(equalTo: contentGroup.bottomAnchor),
      actionArea.widthAnchor.constraint(equalToConstant: 272),
      actionArea.heightAnchor.constraint(equalToConstant: 40),
      readyActionRow.centerXAnchor.constraint(equalTo: actionArea.centerXAnchor),
      readyActionRow.centerYAnchor.constraint(equalTo: actionArea.centerYAnchor),
      readyActionRow.widthAnchor.constraint(equalToConstant: 144),
      readyActionRow.heightAnchor.constraint(equalToConstant: 40),
      installButton.centerXAnchor.constraint(equalTo: readyActionRow.centerXAnchor),
      installButton.centerYAnchor.constraint(equalTo: readyActionRow.centerYAnchor),
      installButton.widthAnchor.constraint(equalToConstant: 144),
      installButton.heightAnchor.constraint(equalToConstant: 40),
      progressActionRow.centerXAnchor.constraint(equalTo: actionArea.centerXAnchor),
      progressActionRow.centerYAnchor.constraint(equalTo: actionArea.centerYAnchor),
      progressActionRow.widthAnchor.constraint(equalToConstant: 272),
      progressActionRow.heightAnchor.constraint(equalToConstant: 32),
      progressView.centerXAnchor.constraint(equalTo: progressActionRow.centerXAnchor),
      progressView.centerYAnchor.constraint(equalTo: progressActionRow.centerYAnchor),
      progressView.widthAnchor.constraint(equalToConstant: 272),
      progressView.heightAnchor.constraint(equalToConstant: 4),
      installLocationFooter.leadingAnchor.constraint(equalTo: background.leadingAnchor),
      installLocationFooter.trailingAnchor.constraint(equalTo: background.trailingAnchor),
      installLocationFooter.bottomAnchor.constraint(equalTo: background.bottomAnchor),
      installLocationFooter.heightAnchor.constraint(equalToConstant: 46),
      installLocationLabel.leadingAnchor.constraint(
        equalTo: installLocationFooter.leadingAnchor,
        constant: 18
      ),
      installLocationLabel.centerYAnchor.constraint(
        equalTo: installLocationFooter.centerYAnchor
      ),
      progressPercentageLabel.leadingAnchor.constraint(
        equalTo: installLocationFooter.leadingAnchor,
        constant: 18
      ),
      progressPercentageLabel.centerYAnchor.constraint(
        equalTo: installLocationFooter.centerYAnchor
      ),
      progressPercentageLabel.widthAnchor.constraint(equalToConstant: 60),
      progressPercentageLabel.heightAnchor.constraint(equalToConstant: 18),
      destinationButton.trailingAnchor.constraint(
        equalTo: installLocationFooter.trailingAnchor,
        constant: -16
      ),
      destinationButton.centerYAnchor.constraint(equalTo: installLocationFooter.centerYAnchor),
      destinationButton.widthAnchor.constraint(equalToConstant: 170),
      destinationButton.heightAnchor.constraint(equalTo: installLocationFooter.heightAnchor),
      destinationChevron.trailingAnchor.constraint(equalTo: destinationButton.trailingAnchor),
      destinationChevron.centerYAnchor.constraint(equalTo: destinationButton.centerYAnchor),
      destinationChevron.widthAnchor.constraint(equalToConstant: 8),
      destinationChevron.heightAnchor.constraint(equalToConstant: 12),
      destinationLabel.leadingAnchor.constraint(equalTo: destinationButton.leadingAnchor),
      destinationLabel.trailingAnchor.constraint(
        equalTo: destinationChevron.leadingAnchor,
        constant: -6
      ),
      destinationLabel.centerYAnchor.constraint(equalTo: destinationButton.centerYAnchor),
      destinationLabel.heightAnchor.constraint(equalToConstant: 18),
    ])

  }

  @objc
  private func destinationButtonPressed() {
    guard installationTask == nil else { return }

    let panel = NSOpenPanel()
    panel.title = "Choose Install Folder"
    panel.message = "Choose where Looper should be installed."
    panel.prompt = "Select"
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.canCreateDirectories = true
    panel.allowsMultipleSelection = false
    panel.directoryURL =
      selectedInstallationDirectory ?? LooperInstaller.defaultInstallationDirectory

    guard panel.runModal() == .OK, let directory = panel.url else { return }
    selectedInstallationDirectory = directory
    updateDestinationLabel()
  }

  @objc
  private func installButtonPressed() {
    if previewState != nil {
      showProgress()
      startPreviewProgress()
      return
    }
    beginInstallation()
  }

  private func beginInstallation() {
    guard installationTask == nil else { return }
    showProgress()
    let requestedDirectory = selectedInstallationDirectory

    installationTask = Task { [weak self] in
      guard let self else { return }
      do {
        let workingDirectory = try Self.makeWorkingDirectory()
        defer { try? FileManager.default.removeItem(at: workingDirectory) }

        setProgress(2)
        let release = try await ReleaseClient.latestRelease()
        try Task.checkCancellation()
        setProgress(8)

        let archiveURL = try await ArchiveDownloader.download(
          release,
          into: workingDirectory,
          progress: { [weak self] fraction in
            self?.setProgress(10 + Int((fraction * 72).rounded(.down)))
          }
        )
        try Task.checkCancellation()
        setProgress(84)

        try await stopRunningLooper()
        try Task.checkCancellation()
        setProgress(88)

        setCriticalInstall(true)
        setProgress(92)
        let installedURL = try await Task.detached {
          try LooperInstaller.install(
            release: release,
            archiveURL: archiveURL,
            workingDirectory: workingDirectory,
            installationDirectory: requestedDirectory
          )
        }.value
        setCriticalInstall(false)
        try Task.checkCancellation()
        setProgress(100)

        #if DEBUG_INSTALLER
          let shouldSkipLaunch =
            ProcessInfo.processInfo.environment["LOOPER_INSTALLER_SKIP_LAUNCH"] == "1"
          if shouldSkipLaunch {
            NSApp.terminate(nil)
            return
          }
        #endif

        guard NSWorkspace.shared.open(installedURL) else {
          throw InstallerError.installationFailed
        }
        window?.orderOut(nil)
        NSApp.terminate(nil)
      } catch is CancellationError {
        return
      } catch {
        NSLog("Looper installation failed: %@", String(describing: error))
        showFailure(error)
      }
    }
  }

  private func showFailure(_ error: Error) {
    setCriticalInstall(false)
    installationTask = nil
    showReady()

    let alert = NSAlert()
    alert.alertStyle = .warning
    alert.messageText = "Couldn’t Install Looper"
    alert.informativeText =
      (error as? LocalizedError)?.errorDescription
      ?? "Looper could not be installed. Please try again."
    alert.addButton(withTitle: "OK")
    if let window {
      alert.beginSheetModal(for: window)
    } else {
      alert.runModal()
    }
  }

  private func showReady() {
    previewProgressTask?.cancel()
    previewProgressTask = nil
    currentProgress = 0
    progressView.stopAnimation()
    readyActionRow.isHidden = false
    progressActionRow.isHidden = true
    installLocationLabel.isHidden = false
    destinationButton.isHidden = false
    progressPercentageLabel.isHidden = true
    destinationButton.setInteractionEnabled(true)
    installButton.isEnabled = true
    updateDestinationLabel()
  }

  private func showProgress() {
    currentProgress = 0
    readyActionRow.isHidden = true
    progressActionRow.isHidden = false
    installLocationLabel.isHidden = true
    destinationButton.isHidden = true
    progressPercentageLabel.isHidden = false
    destinationButton.setInteractionEnabled(false)
    installButton.isEnabled = false
    setProgress(0)
    progressView.startAnimation()
  }

  private func setProgress(_ percent: Int) {
    currentProgress = max(currentProgress, min(100, max(0, percent)))
    progressPercentageLabel.stringValue = "\(currentProgress)%"
    progressView.setProgressPercent(currentProgress)
  }

  private func startPreviewProgress() {
    previewProgressTask?.cancel()
    previewProgressTask = Task { [weak self] in
      for percent in 0...100 {
        guard !Task.isCancelled else { return }
        self?.setProgress(percent)
        try? await Task.sleep(for: .milliseconds(55))
      }
    }
  }

  private func updateDestinationLabel() {
    let destination =
      selectedInstallationDirectory ?? LooperInstaller.defaultInstallationDirectory
    let folderName = FileManager.default.displayName(atPath: destination.path)
    destinationLabel.stringValue = "…/\(folderName)"
    destinationButton.toolTip =
      "Install in \(destination.path). Click to choose a different folder."
    destinationButton.setAccessibilityLabel(
      "Install destination: \(destination.path). Choose a different folder."
    )
  }

  private func setCriticalInstall(_ isCritical: Bool) {
    isPerformingCriticalInstall = isCritical
    window?.standardWindowButton(.closeButton)?.isEnabled = !isCritical
  }

  private func stopRunningLooper() async throws {
    let runningApps = NSRunningApplication.runningApplications(
      withBundleIdentifier: looperBundleIdentifier
    )
    guard !runningApps.isEmpty else { return }

    for runningApp in runningApps {
      runningApp.terminate()
    }
    for _ in 0..<50 {
      if runningApps.allSatisfy({ $0.isTerminated }) {
        return
      }
      try await Task.sleep(for: .milliseconds(100))
    }
    throw InstallerError.appIsRunning
  }

  private static func makeWorkingDirectory() throws -> URL {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(
      "com.nickbolton.looper.installer-\(UUID().uuidString)",
      isDirectory: true
    )
    try FileManager.default.createDirectory(
      at: directory,
      withIntermediateDirectories: true
    )
    return directory
  }
}

@MainActor
private final class AppDelegate: NSObject, NSApplicationDelegate {
  private var windowController: InstallerWindowController?

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.regular)
    let controller = InstallerWindowController()
    windowController = controller
    controller.showWindow(nil)
    NSApp.activate(ignoringOtherApps: true)
    controller.prepareForDisplay()
  }

  func applicationShouldTerminateAfterLastWindowClosed(
    _ sender: NSApplication
  ) -> Bool {
    true
  }

  func applicationShouldTerminate(
    _ sender: NSApplication
  ) -> NSApplication.TerminateReply {
    windowController?.isPerformingCriticalInstall == true
      ? .terminateCancel
      : .terminateNow
  }
}

@main
private enum InstallerApplication {
  @MainActor
  static func main() {
    let application = NSApplication.shared
    let delegate = AppDelegate()
    application.delegate = delegate
    application.run()
  }
}
