import AppKit
import Foundation

struct SymbolAsset {
  let systemName: String
  let fileName: String
}

let assets = [
  SymbolAsset(systemName: "chevron.left", fileName: "back.png"),
  SymbolAsset(systemName: "checkmark", fileName: "check.png"),
  SymbolAsset(systemName: "plus", fileName: "add-document.png"),
  SymbolAsset(systemName: "arrow.triangle.2.circlepath", fileName: "cycle.png"),
  SymbolAsset(systemName: "doc.badge.plus", fileName: "new-document.png"),
  SymbolAsset(systemName: "folder", fileName: "open-document.png"),
  SymbolAsset(systemName: "gearshape", fileName: "settings.png"),
  SymbolAsset(systemName: "line.3.horizontal", fileName: "drag-handle.png"),
  SymbolAsset(systemName: "line.3.horizontal.decrease", fileName: "filter.png"),
  SymbolAsset(systemName: "lock.fill", fileName: "lock.png"),
  SymbolAsset(systemName: "sidebar.right", fileName: "sidebar-right.png"),
  SymbolAsset(systemName: "rectangle.rightthird.inset.filled", fileName: "sidebar-right-filled.png")
]

guard CommandLine.arguments.count == 2 else {
  fputs("usage: swift generate_sf_symbols.swift <output-dir>\n", stderr)
  exit(2)
}

let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let canvasSize = NSSize(width: 64, height: 64)
let symbolConfiguration = NSImage.SymbolConfiguration(pointSize: 29, weight: .regular)

for asset in assets {
  guard let sourceImage = NSImage(
    systemSymbolName: asset.systemName,
    accessibilityDescription: nil
  )?.withSymbolConfiguration(symbolConfiguration) else {
    fputs("Unable to load SF Symbol: \(asset.systemName)\n", stderr)
    exit(1)
  }

  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(canvasSize.width),
    pixelsHigh: Int(canvasSize.height),
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else {
    fputs("Unable to create bitmap for \(asset.systemName)\n", stderr)
    exit(1)
  }

  guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fputs("Unable to create drawing context for \(asset.systemName)\n", stderr)
    exit(1)
  }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  context.imageInterpolation = .high

  NSColor.clear.setFill()
  NSRect(origin: .zero, size: canvasSize).fill()

  let imageSize = sourceImage.size
  let drawRect = NSRect(
    x: (canvasSize.width - imageSize.width) / 2,
    y: (canvasSize.height - imageSize.height) / 2,
    width: imageSize.width,
    height: imageSize.height
  )
  sourceImage.draw(in: drawRect, from: .zero, operation: .sourceOver, fraction: 1)

  NSGraphicsContext.restoreGraphicsState()

  guard let pngData = bitmap.representation(using: .png, properties: [:]) else {
    fputs("Unable to encode PNG for \(asset.systemName)\n", stderr)
    exit(1)
  }

  let outputURL = outputDirectory.appendingPathComponent(asset.fileName)
  try pngData.write(to: outputURL)
}
