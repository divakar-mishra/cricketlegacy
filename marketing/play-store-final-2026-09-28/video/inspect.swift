import Foundation
import AVFoundation
import AppKit

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let out = root.appendingPathComponent("marketing/play-store-final-2026-09-28/video/review")
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
let movies = [("player-fresh", "marketing/play-store-final-2026-09-28/sources/fresh/player-live-normal.mp4", [0.0,1,2,3,4,5,6,7,8,10])]
for (name, path, times) in movies {
 let asset = AVURLAsset(url: root.appendingPathComponent(path))
 print("MOVIE \(name) duration \(asset.duration.seconds) tracks \(asset.tracks.map { "\($0.mediaType.rawValue):\($0.naturalSize)" })")
 let gen = AVAssetImageGenerator(asset: asset)
 gen.appliesPreferredTrackTransform = true
 gen.requestedTimeToleranceBefore = .zero
 gen.requestedTimeToleranceAfter = .zero
 gen.maximumSize = CGSize(width: 720, height: 1280)
 let size = CGSize(width: 1500, height: 1180)
 let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size.width), pixelsHigh: Int(size.height), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
 NSGraphicsContext.saveGraphicsState()
 NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
 NSColor(calibratedWhite: 0.10, alpha: 1).setFill()
 NSRect(origin: .zero, size: size).fill()
 for (i,t) in times.enumerated() where t < asset.duration.seconds {
   do {
    let cg = try gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil)
    let img = NSImage(cgImage: cg, size: .zero)
    let x = CGFloat(i % 5) * 300 + 8
    let y = 1180 - CGFloat(i / 5 + 1) * 590 + 30
    let ratio = min(284 / CGFloat(cg.width), 550 / CGFloat(cg.height))
    img.draw(in: NSRect(x: x, y:y, width: CGFloat(cg.width)*ratio, height:CGFloat(cg.height)*ratio))
    ("\(name) \(t)s" as NSString).draw(at: NSPoint(x:x,y:y-24), withAttributes:[.font:NSFont.systemFont(ofSize:16,weight:.bold),.foregroundColor:NSColor.white])
    let png = NSBitmapImageRep(cgImage:cg).representation(using:.png,properties:[:])!
    try png.write(to:out.appendingPathComponent("\(name)-\(Int(t)).png"))
   } catch { print(error) }
 }
 NSGraphicsContext.restoreGraphicsState()
 try rep.representation(using:.png,properties:[:])!.write(to:out.appendingPathComponent("\(name)-contact.png"))
}
