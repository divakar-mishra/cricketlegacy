#!/usr/bin/env swift
// Editable deterministic screenshot compositor. Source UI pixels are never regenerated.
import AppKit
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

struct Piece: Codable { let source: String; let crop: [Double]; let rect: [Double]; let label: String? }
struct Panel: Codable { let file: String; let eyebrow: String; let title: [String]; let subtitle: String; let pieces: [Piece] }
let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "marketing/play-store-final-2026-09-28", isDirectory: true)
let manifest = try JSONDecoder().decode([Panel].self, from: Data(contentsOf: root.appendingPathComponent("project/screenshots.json")))
let fm = FileManager.default
try fm.createDirectory(at: root.appendingPathComponent("screenshots"), withIntermediateDirectories: true)
for name in ["Sora_800ExtraBold.ttf", "Inter_500Medium.ttf", "Inter_700Bold.ttf"] {
  CTFontManagerRegisterFontsForURL(root.appendingPathComponent("project/fonts/\(name)") as CFURL, .process, nil)
}
func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> NSColor {
  NSColor(srgbRed: CGFloat((hex >> 16) & 255)/255, green: CGFloat((hex >> 8) & 255)/255, blue: CGFloat(hex & 255)/255, alpha: alpha)
}
let gold = color(0xE5BE63), white = color(0xF6F4EA)
func rect(_ a: [Double]) -> CGRect { CGRect(x:a[0],y:a[1],width:a[2],height:a[3]) }
func readImage(_ path: URL) -> CGImage {
  guard let source = CGImageSourceCreateWithURL(path as CFURL,nil), let img = CGImageSourceCreateImageAtIndex(source,0,nil) else { fatalError("Missing image \(path.path)") }; return img
}
func image(_ cg: CGContext, _ img: CGImage, _ dest: CGRect) {
  cg.saveGState(); cg.translateBy(x:dest.minX,y:dest.maxY); cg.scaleBy(x:1,y:-1)
  cg.interpolationQuality = .high
  cg.draw(img,in:CGRect(x:0,y:0,width:dest.width,height:dest.height)); cg.restoreGState()
}
func text(_ s: String, _ r: CGRect, _ size: CGFloat, _ ink: NSColor, _ face: String = "Inter-Medium", _ tracking: CGFloat = 0) {
  let p = NSMutableParagraphStyle(); p.lineBreakMode = .byWordWrapping; p.lineSpacing = 0
  let font = NSFont(name:face,size:size) ?? NSFont.systemFont(ofSize:size,weight:.bold)
  let attrs: [NSAttributedString.Key:Any] = [.font:font,.foregroundColor:ink,.paragraphStyle:p,.kern:tracking]
  (s as NSString).draw(in:r,withAttributes:attrs)
}
func write(_ img: CGImage, _ url: URL) {
  let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString,1,nil)!
  CGImageDestinationAddImage(dest,img,nil); assert(CGImageDestinationFinalize(dest))
}
func canvas(_ width: Int, _ height: Int) -> CGContext {
  CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue)!
}
for (index,panel) in manifest.enumerated() {
  let cg = canvas(1080,1920)
  cg.translateBy(x:0,y:1920); cg.scaleBy(x:1,y:-1)
  NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(cgContext:cg,flipped:true)
  let gradient = CGGradient(colorsSpace:CGColorSpace(name:CGColorSpace.sRGB),colors:[color(0x07372A).cgColor,color(0x0A1418).cgColor,color(0x080D13).cgColor] as CFArray,locations:[0,0.4,1])!
  cg.drawLinearGradient(gradient,start:CGPoint(x:0,y:0),end:CGPoint(x:1080,y:1920),options:[])
  // Quiet cricket-boundary arcs are graphic ornament, not simulated gameplay.
  cg.setStrokeColor(gold.withAlphaComponent(0.09).cgColor); cg.setLineWidth(2)
  for offset in [0.0,28.0,70.0] { cg.strokeEllipse(in:CGRect(x:540-offset,y:-330-offset,width:900+2*offset,height:750+2*offset)) }
  cg.setFillColor(gold.cgColor); cg.fill(CGRect(x:48,y:42,width:42,height:4))
  text(panel.eyebrow,CGRect(x:106,y:27,width:860,height:40),23,gold,"Inter-Bold",2.2)
  text(String(format:"%02d",index+1),CGRect(x:982,y:26,width:62,height:38),25,gold,"Inter-Bold")
  for (line,t) in panel.title.enumerated() {
    text(t,CGRect(x:44,y:85+Double(line)*94,width:1010,height:115),82,line==0 ? white : gold,"Sora-ExtraBold",-2.5)
  }
  text(panel.subtitle,CGRect(x:48,y:288,width:984,height:54),27,color(0xB9CBC5))
  for piece in panel.pieces {
    let src = readImage(root.appendingPathComponent(piece.source))
    guard let cropped = src.cropping(to:rect(piece.crop)) else { fatalError("Invalid crop: \(piece.source)") }
    let target = rect(piece.rect)
    // Never stretch the game's UI. Each crop keeps its original pixel aspect ratio.
    let scale = min(target.width/CGFloat(cropped.width),target.height/CGFloat(cropped.height))
    let dest = CGRect(x:target.midX-CGFloat(cropped.width)*scale/2,y:target.minY,width:CGFloat(cropped.width)*scale,height:CGFloat(cropped.height)*scale)
    cg.saveGState(); cg.setShadow(offset:CGSize(width:0,height:12),blur:28,color:NSColor.black.withAlphaComponent(0.35).cgColor)
    cg.setFillColor(color(0x0C101B).cgColor); cg.fill(dest); cg.restoreGState()
    image(cg,cropped,dest)
    cg.setStrokeColor(gold.withAlphaComponent(0.45).cgColor); cg.setLineWidth(1.5); cg.stroke(dest)
    if let label = piece.label {
      text(label,CGRect(x:target.minX,y:target.minY-37,width:target.width,height:32),20,gold,"Inter-Bold",1.4)
    }
  }
  cg.setFillColor(gold.withAlphaComponent(0.42).cgColor); cg.fill(CGRect(x:48,y:1847,width:984,height:1))
  text("Cricket: Player and Manager",CGRect(x:48,y:1870,width:930,height:38),24,white,"Inter-Medium",0.3)
  for dot in 0..<8 {
    cg.setFillColor((dot==index ? gold : gold.withAlphaComponent(0.22)).cgColor)
    cg.fillEllipse(in:CGRect(x:877+dot*20,y:1880,width:7,height:7))
  }
  NSGraphicsContext.restoreGraphicsState()
  write(cg.makeImage()!,root.appendingPathComponent("screenshots/\(panel.file)"))
  print("Rendered \(panel.file)")
}
// Contact sheet: 4 × 2, display order left-to-right, then down.
let sheet = canvas(1440,1380)
sheet.translateBy(x:0,y:1380); sheet.scaleBy(x:1,y:-1)
NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(cgContext:sheet,flipped:true)
sheet.setFillColor(color(0x080D13).cgColor); sheet.fill(CGRect(x:0,y:0,width:1440,height:1380))
text("CRICKET: PLAYER AND MANAGER",CGRect(x:34,y:20,width:1370,height:50),29,gold,"Inter-Bold",1)
for (i,p) in manifest.enumerated() {
 let x = 30+(i%4)*352, y = 84+(i/4)*644
 image(sheet,readImage(root.appendingPathComponent("screenshots/\(p.file)")),CGRect(x:x,y:y,width:324,height:576))
 text(String(format:"%02d",i+1)+"  "+p.eyebrow,CGRect(x:x,y:y+587,width:324,height:39),13,color(0xB9CBC5),"Inter-Bold",0.2)
}
NSGraphicsContext.restoreGraphicsState(); write(sheet.makeImage()!,root.appendingPathComponent("CONTACT_SHEET.png"))
print("Rendered CONTACT_SHEET.png")
