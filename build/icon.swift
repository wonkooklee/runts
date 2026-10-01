import AppKit

let size: CGFloat = 1024
let rep = NSBitmapImageRep(
  bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size), bitsPerSample: 8,
  samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
  bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

func hex(_ value: Int) -> NSColor {
  NSColor(
    red: CGFloat((value >> 16) & 0xff) / 255, green: CGFloat((value >> 8) & 0xff) / 255,
    blue: CGFloat(value & 0xff) / 255, alpha: 1)
}

let tile = NSRect(x: 100, y: 100, width: 824, height: 824)
let tilePath = NSBezierPath(roundedRect: tile, xRadius: 185, yRadius: 185)

NSGraphicsContext.saveGraphicsState()
let shadow = NSShadow()
shadow.shadowColor = NSColor.black.withAlphaComponent(0.3)
shadow.shadowBlurRadius = 28
shadow.shadowOffset = NSSize(width: 0, height: -12)
shadow.set()
NSColor.white.setFill()
tilePath.fill()
NSGraphicsContext.restoreGraphicsState()

NSGradient(starting: hex(0xFFFFFF), ending: hex(0xEEF1F6))!.draw(in: tilePath, angle: -90)

let braceAttrs: [NSAttributedString.Key: Any] = [
  .font: NSFont.monospacedSystemFont(ofSize: 380, weight: .medium),
  .foregroundColor: hex(0x8A94A6),
]
for (text, x) in [("{", 108.0), ("}", 688.0)] {
  NSAttributedString(string: text, attributes: braceAttrs).draw(at: NSPoint(x: x, y: 290))
}

let bounds = (x: 82.0, y: 185.0, width: 538.642, height: 342.0)
let scale = 340.0 / bounds.width
let origin = NSPoint(x: 512 - bounds.width * scale / 2, y: 512 - bounds.height * scale / 2)
func point(_ x: Double, _ y: Double) -> NSPoint {
  NSPoint(x: origin.x + (x - bounds.x) * scale, y: origin.y + (bounds.y + bounds.height - y) * scale)
}

let polygons: [([(Double, Double)], Int)] = [
  ([(298, 185), (415, 185), (620.642, 527), (503.642, 527)], 0x1F4698),
  ([(415, 185), (298, 185), (298, 527), (415, 527)], 0x2A6ADF),
  ([(82, 185), (211.27, 185), (420, 527), (290.73, 527)], 0xF2B52F),
]
for (vertices, color) in polygons {
  let path = NSBezierPath()
  path.move(to: point(vertices[0].0, vertices[0].1))
  for v in vertices.dropFirst() { path.line(to: point(v.0, v.1)) }
  path.close()
  hex(color).setFill()
  path.fill()
}

let center = point(554.5, 243.5)
let r = 58.5 * scale
hex(0x4B9A4F).setFill()
NSBezierPath(ovalIn: NSRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2)).fill()

NSGraphicsContext.restoreGraphicsState()
let out = CommandLine.arguments[1]
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
