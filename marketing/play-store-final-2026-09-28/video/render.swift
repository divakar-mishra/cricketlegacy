// Editable, dependency-free macOS trailer renderer. Run from this directory:
// swift -module-cache-path /private/tmp/cricket-marketing-swift-cache render.swift
// Edit project.json (source media, crops, titles, durations) to re-cut the film.
import Foundation
import AVFoundation
import AppKit
import CoreText

struct Clip: Codable {
 let kind: String
 let source: String
 let seconds: Double
 let sourceStart: Double?
 let crop: [Double]?
 let eyebrow: String
 let line1: String
 let line2: String
}
struct Project: Codable {
 let width: Int
 let height: Int
 let fps: Int
 let music: String
 let icon: String
 let titleFont: String
 let bodyFont: String
 let clips: [Clip]
}

let dir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let project = try JSONDecoder().decode(Project.self, from: Data(contentsOf: dir.appendingPathComponent("project.json")))
let W = project.width, H = project.height, FPS = project.fps
let output = dir.appendingPathComponent("cricket-player-and-manager-preview-45s.mp4")
let silent = dir.appendingPathComponent("render-intermediate.mp4")
let fm = FileManager.default
for path in [output,silent] where fm.fileExists(atPath:path.path) { try fm.removeItem(at:path) }
for font in [project.titleFont,project.bodyFont] {
 CTFontManagerRegisterFontsForURL(dir.appendingPathComponent(font) as CFURL, .process, nil)
}
func font(_ size: CGFloat, bold: Bool = false) -> NSFont {
 NSFont(name:bold ? "Sora-ExtraBold" : "Inter-Medium", size:size) ?? NSFont.systemFont(ofSize:size,weight:bold ? .bold : .medium)
}
func color(_ hex: UInt32, _ alpha:CGFloat = 1) -> NSColor {
 NSColor(calibratedRed:CGFloat((hex>>16)&255)/255, green:CGFloat((hex>>8)&255)/255, blue:CGFloat(hex&255)/255,alpha:alpha)
}
let gold = color(0xE5BE63), white = color(0xF6F4EA), muted = color(0xA6BEB4)
func text(_ text: String, rect: CGRect, size: CGFloat, bold: Bool=false, colour: NSColor=white, align: NSTextAlignment = .left) {
 let para = NSMutableParagraphStyle(); para.alignment=align; para.lineBreakMode = .byWordWrapping
 (text as NSString).draw(in:rect,withAttributes:[.font:font(size,bold:bold),.foregroundColor:colour,.paragraphStyle:para])
}
func loadImage(_ path:String) -> CGImage {
 let img = NSImage(contentsOf:dir.appendingPathComponent(path))!
 return img.cgImage(forProposedRect:nil,context:nil,hints:nil)!
}
func drawImage(_ img:CGImage, _ rect:CGRect, in ctx:CGContext) {
 ctx.saveGState(); ctx.translateBy(x:rect.minX,y:rect.maxY);ctx.scaleBy(x:1,y:-1)
 ctx.draw(img,in:CGRect(x:0,y:0,width:rect.width,height:rect.height));ctx.restoreGState()
}
func rounded(_ rect:CGRect, radius:CGFloat, ctx:CGContext) {
 ctx.addPath(CGPath(roundedRect:rect,cornerWidth:radius,cornerHeight:radius,transform:nil))
}
let icon=loadImage(project.icon)
var stills:[Int:CGImage]=[:], generators:[Int:AVAssetImageGenerator]=[:]
for (i,clip) in project.clips.enumerated() {
 if clip.kind == "video" {
   let gen=AVAssetImageGenerator(asset:AVURLAsset(url:dir.appendingPathComponent(clip.source)))
   gen.appliesPreferredTrackTransform=true
   gen.requestedTimeToleranceBefore = .zero;gen.requestedTimeToleranceAfter = .zero
   generators[i]=gen
 } else if clip.kind == "still" { stills[i]=loadImage(clip.source) }
}
let writer=try AVAssetWriter(outputURL:silent,fileType:.mp4)
let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:W,AVVideoHeightKey:H,AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:12_000_000,AVVideoExpectedSourceFrameRateKey:FPS,AVVideoMaxKeyFrameIntervalKey:FPS*2,AVVideoProfileLevelKey:AVVideoProfileLevelH264HighAutoLevel]])
input.expectsMediaDataInRealTime=false
let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:W,kCVPixelBufferHeightKey as String:H,kCVPixelBufferCGImageCompatibilityKey as String:true,kCVPixelBufferCGBitmapContextCompatibilityKey as String:true])
writer.add(input); writer.startWriting();writer.startSession(atSourceTime:.zero)
let duration=project.clips.reduce(0.0){$0+$1.seconds}
var frame=0, srt="", globalStart=0.0
func srtTime(_ sec:Double)->String {
 let ms=Int((sec*1000).rounded());return String(format:"%02d:%02d:%02d,%03d",ms/3600000,(ms/60000)%60,(ms/1000)%60,ms%1000)
}
let review=dir.appendingPathComponent("review/final")
try fm.createDirectory(at:review,withIntermediateDirectories:true)
for (scene,clip) in project.clips.enumerated() {
 let n=Int((clip.seconds*Double(FPS)).rounded())
 srt += "\(scene+1)\n\(srtTime(globalStart)) --> \(srtTime(globalStart+clip.seconds))\n\(clip.line1) \(clip.line2)\n\n"
 print("Rendering scene \(scene+1): \(clip.line1) \(clip.line2) (\(n) frames)")
 fflush(stdout)
 for f in 0..<n {
  try autoreleasepool {
   while !input.isReadyForMoreMediaData { if writer.status == .failed { throw writer.error! }; Thread.sleep(forTimeInterval:0.004) }
   var buf:CVPixelBuffer?
   CVPixelBufferPoolCreatePixelBuffer(nil,adaptor.pixelBufferPool!,&buf)
   let pixel=buf!; CVPixelBufferLockBaseAddress(pixel,[])
   let ctx=CGContext(data:CVPixelBufferGetBaseAddress(pixel),width:W,height:H,bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(pixel),space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!
   ctx.interpolationQuality = .high
   ctx.translateBy(x:0,y:CGFloat(H));ctx.scaleBy(x:1,y:-1)
   NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(cgContext:ctx,flipped:true)
   let gradient=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:[color(0x062D23).cgColor,color(0x080D13).cgColor] as CFArray,locations:[0,1])!
   ctx.drawLinearGradient(gradient,start:CGPoint(x:0,y:0),end:CGPoint(x:750,y:1300),options:[.drawsAfterEndLocation])
   // Restrained ground-boundary line; editorial decoration, never a fabricated screen.
   ctx.setStrokeColor(color(0x87AA8B,0.09).cgColor);ctx.setLineWidth(2)
   ctx.strokeEllipse(in:CGRect(x:-250,y:330,width:1500,height:1650))
   let t=Double(f)/Double(FPS), progress=CGFloat(f)/CGFloat(max(1,n-1))
   if clip.kind == "end" {
    let k=1+0.015*progress
    let rect=CGRect(x:540-190*k,y:380-190*(k-1),width:380*k,height:380*k)
    ctx.saveGState();rounded(rect,radius:70,ctx:ctx);ctx.clip();drawImage(icon,rect,in:ctx);ctx.restoreGState()
    text("Cricket:",rect:CGRect(x:75,y:840,width:930,height:130),size:98,bold:true,align:.center)
    text("Player and Manager",rect:CGRect(x:60,y:975,width:960,height:210),size:67,bold:true,colour:gold,align:.center)
    ctx.setFillColor(gold.cgColor);ctx.fill(CGRect(x:460,y:1210,width:160,height:4))
    text("Your player. Your club. Your story.",rect:CGRect(x:70,y:1280,width:940,height:100),size:34,colour:muted,align:.center)
   } else {
    text(clip.eyebrow.uppercased(),rect:CGRect(x:56,y:55,width:960,height:50),size:24,colour:gold)
    text(clip.line1,rect:CGRect(x:50,y:105,width:980,height:100),size:66,bold:true)
    text(clip.line2,rect:CGRect(x:50,y:188,width:980,height:100),size:66,bold:true,colour:gold)
    ctx.setFillColor(gold.cgColor);ctx.fill(CGRect(x:54,y:294,width:96,height:4))
    let source:CGImage
    if let gen=generators[scene] {
      source=try gen.copyCGImage(at:CMTime(seconds:(clip.sourceStart ?? 0)+t,preferredTimescale:600),actualTime:nil)
    } else { source=stills[scene]! }
    var image=source
    if let c=clip.crop { image=source.cropping(to:CGRect(x:c[0],y:c[1],width:c[2],height:c[3]))! }
    let box=CGRect(x:54,y:335,width:972,height:1500)
    let zoom:CGFloat=clip.kind == "still" ? (1.0+0.012*progress) : 1
    let scale=min(box.width/CGFloat(image.width),box.height/CGFloat(image.height))*zoom
    let iw=CGFloat(image.width)*scale, ih=CGFloat(image.height)*scale
    let rect=CGRect(x:box.midX-iw/2,y:box.midY-ih/2,width:iw,height:ih)
    ctx.saveGState(); rounded(box,radius:18,ctx:ctx);ctx.clip();drawImage(image,rect,in:ctx);ctx.restoreGState()
    text("CRICKET: PLAYER AND MANAGER",rect:CGRect(x:55,y:1860,width:950,height:36),size:19,colour:muted)
   }
   ctx.setFillColor(color(0xE5BE63,0.30).cgColor);ctx.fill(CGRect(x:0,y:1915,width:1080,height:5))
   ctx.setFillColor(gold.cgColor);ctx.fill(CGRect(x:0,y:1915,width:1080*CGFloat((globalStart+t)/duration),height:5))
   // A brief dip gives each chapter a clean cut; the opening is visible at frame 0.
   if scene>0 && t<0.12 { ctx.setFillColor(color(0x080D13,CGFloat(1-t/0.12)).cgColor);ctx.fill(CGRect(x:0,y:0,width:W,height:H)) }
   NSGraphicsContext.restoreGraphicsState()
   if f == min(n-1,FPS) {
     let png=NSBitmapImageRep(cgImage:ctx.makeImage()!).representation(using:.png,properties:[:])!
     try png.write(to:review.appendingPathComponent(String(format:"scene-%02d.png",scene+1)))
   }
   CVPixelBufferUnlockBaseAddress(pixel,[])
   guard adaptor.append(pixel,withPresentationTime:CMTime(value:Int64(frame),timescale:Int32(FPS))) else { throw writer.error! }
   frame+=1
  }
 }
 globalStart+=clip.seconds
}
input.markAsFinished()
let sem=DispatchSemaphore(value:0);writer.finishWriting{sem.signal()};sem.wait()
if writer.status != .completed { throw writer.error! }
try srt.write(to:dir.appendingPathComponent("captions.srt"),atomically:true,encoding:.utf8)
let webvtt = "WEBVTT\n\n" + srt.replacingOccurrences(of: ",", with: ".")
try webvtt.write(to:dir.appendingPathComponent("captions.vtt"),atomically:true,encoding:.utf8)
// Original selected B music, quiet and looped without changing pitch or melody.
let composition=AVMutableComposition()
let base=AVURLAsset(url:silent)
let video=composition.addMutableTrack(withMediaType:.video,preferredTrackID:kCMPersistentTrackID_Invalid)!
try video.insertTimeRange(CMTimeRange(start:.zero,duration:CMTime(seconds:duration,preferredTimescale:600)),of:base.tracks(withMediaType:.video).first!,at:.zero)
let music=AVURLAsset(url:dir.appendingPathComponent(project.music))
let audio=composition.addMutableTrack(withMediaType:.audio,preferredTrackID:kCMPersistentTrackID_Invalid)!
var cursor=0.0
while cursor < duration {
 let len=min(music.duration.seconds,duration-cursor)
 try audio.insertTimeRange(CMTimeRange(start:.zero,duration:CMTime(seconds:len,preferredTimescale:600)),of:music.tracks(withMediaType:.audio).first!,at:CMTime(seconds:cursor,preferredTimescale:600))
 cursor+=len
}
let parameters=AVMutableAudioMixInputParameters(track:audio)
parameters.setVolumeRamp(fromStartVolume:0,toEndVolume:0.55,timeRange:CMTimeRange(start:.zero,duration:CMTime(seconds:0.8,preferredTimescale:600)))
parameters.setVolume(0.55,at:CMTime(seconds:0.8,preferredTimescale:600))
parameters.setVolumeRamp(fromStartVolume:0.55,toEndVolume:0,timeRange:CMTimeRange(start:CMTime(seconds:duration-2,preferredTimescale:600),duration:CMTime(seconds:2,preferredTimescale:600)))
let mix=AVMutableAudioMix();mix.inputParameters=[parameters]
let export=AVAssetExportSession(asset:composition,presetName:AVAssetExportPresetHighestQuality)!
export.outputURL=output;export.outputFileType = .mp4;export.shouldOptimizeForNetworkUse=true;export.audioMix=mix
let finish=DispatchSemaphore(value:0);export.exportAsynchronously{finish.signal()};finish.wait()
if export.status != .completed { throw export.error! }
let final=AVURLAsset(url:output)
let videoTracks = final.tracks(withMediaType:.video)
let report="Rendered \(frame) frames at \(FPS)fps. Duration \(final.duration.seconds)s. Video tracks: \(videoTracks.map{$0.naturalSize}). Nominal frame rates: \(videoTracks.map{$0.nominalFrameRate}). Audio tracks: \(final.tracks(withMediaType:.audio).count). Scene count: \(project.clips.count).\n"
print(report)
try report.write(to:dir.appendingPathComponent("render-validation.txt"),atomically:true,encoding:.utf8)
