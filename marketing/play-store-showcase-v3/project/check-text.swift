// OCR review of exported panels. The originals are not changed.
import Foundation
import Vision
import ImageIO
let root = URL(fileURLWithPath:CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "marketing/play-store-showcase-v3")
let files = try FileManager.default.contentsOfDirectory(at:root.appendingPathComponent("screenshots"),includingPropertiesForKeys:nil).filter{$0.pathExtension=="png"}.sorted{$0.lastPathComponent<$1.lastPathComponent}
var log = "OCR text audit — actual UI text is retained; no OCR rewriting.\n"
var failures:[String]=[]
for file in files {
 let request=VNRecognizeTextRequest();request.recognitionLevel = .accurate;request.usesLanguageCorrection = false
 try VNImageRequestHandler(url:file,options:[:]).perform([request])
 let strings=(request.results ?? []).compactMap{$0.topCandidates(1).first?.string}
 let joined=strings.joined(separator:"\n")
 for blocked in ["Cricket Legacy","Player and Manager","Download now","QA Tools","Emulator","Coming soon"] where joined.localizedCaseInsensitiveContains(blocked) { failures.append("\(file.lastPathComponent): \(blocked)") }
 if !joined.contains("Cricket: Player & Manager") { failures.append("\(file.lastPathComponent): exact app title missing") }
 log += "\n## \(file.lastPathComponent)\n"+joined+"\n"
}
log += "\nBlocked phrase findings: \(failures.isEmpty ? "None" : failures.joined(separator:", "))\n"
try log.write(to:root.appendingPathComponent("TEXT_REVIEW.txt"),atomically:true,encoding:.utf8)
print("OCR reviewed \(files.count) panels; blocked phrases: \(failures)")
exit(failures.isEmpty ? 0:1)
