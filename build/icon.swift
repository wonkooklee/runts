import AppKit

let size: CGFloat = 1024
let rep = NSBitmapImageRep(
  bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size), bitsPerSample: 8,
  samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
  bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

let tile = NSRect(x: 100, y: 100, width: 824, height: 824)
let tilePath = NSBezierPath(roundedRect: tile, xRadius: 185, yRadius: 185)

NSGraphicsContext.saveGraphicsState()
let shadow = NSShadow()
shadow.shadowColor = NSColor.black.withAlphaComponent(0.35)
shadow.shadowBlurRadius = 28
shadow.shadowOffset = NSSize(width: 0, height: -12)
shadow.set()
NSColor(red: 0.09, green: 0.10, blue: 0.13, alpha: 1).setFill()
tilePath.fill()
NSGraphicsContext.restoreGraphicsState()

NSGradient(
  starting: NSColor(red: 0.16, green: 0.18, blue: 0.24, alpha: 1),
  ending: NSColor(red: 0.07, green: 0.08, blue: 0.10, alpha: 1))!
  .draw(in: tilePath, angle: -90)

let braceAttrs: [NSAttributedString.Key: Any] = [
  .font: NSFont.monospacedSystemFont(ofSize: 430, weight: .semibold),
  .foregroundColor: NSColor(red: 0.55, green: 0.60, blue: 0.70, alpha: 1),
]
for (text, x) in [("{", 148.0), ("}", 620.0)] {
  NSAttributedString(string: text, attributes: braceAttrs).draw(at: NSPoint(x: x, y: 250))
}

let play = NSBezierPath()
play.move(to: NSPoint(x: 448, y: 362))
play.line(to: NSPoint(x: 448, y: 662))
play.line(to: NSPoint(x: 640, y: 512))
play.close()
play.lineJoinStyle = .round
NSGradient(
  starting: NSColor(red: 0.36, green: 0.62, blue: 1.0, alpha: 1),
  ending: NSColor(red: 0.18, green: 0.42, blue: 0.95, alpha: 1))!
  .draw(in: play, angle: -90)

NSGraphicsContext.restoreGraphicsState()
let out = CommandLine.arguments[1]
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
