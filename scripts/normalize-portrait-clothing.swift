#!/usr/bin/env swift

import CoreGraphics
import CoreML
import CoreVideo
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

private let expectedSize = 300
private let jpegQuality = 0.94

private struct WorkItem: Decodable {
  let id: String
  let source: String
  let destination: String
  let debugMask: String?
}

private struct WorkList: Decodable {
  let items: [WorkItem]
}

private struct PixelImage {
  let width: Int
  let height: Int
  var rgba: [UInt8]
}

private struct FaceBox {
  let minX: Double
  let minY: Double
  let maxX: Double
  let maxY: Double

  var width: Double { maxX - minX }
  var height: Double { maxY - minY }
}

private struct Lab {
  let l: Double
  let a: Double
  let b: Double
}

private struct HSV {
  let h: Double
  let s: Double
  let v: Double
}

private enum ShirtFamily: String {
  case blue
  case green
  case maroon
  case black
}

private struct Analysis {
  let family: ShirtFamily
  let baseMask: [UInt8]
  let skinMask: [Bool]
  let hairMask: [Bool]
  let changedPixels: Int
}

private func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data("[portrait-clothing] \(message)\n".utf8))
  exit(1)
}

private func clamp(_ value: Double, _ lower: Double, _ upper: Double) -> Double {
  min(max(value, lower), upper)
}

private func loadImage(_ path: String) -> (PixelImage, CGImage) {
  let url = URL(fileURLWithPath: path)
  guard
    let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    fail("Could not decode \(path)")
  }
  guard image.width == expectedSize, image.height == expectedSize else {
    fail("\(path) is \(image.width)x\(image.height); expected 300x300")
  }

  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
  var pixels = [UInt8](repeating: 0, count: image.width * image.height * 4)
  guard
    let context = CGContext(
      data: &pixels,
      width: image.width,
      height: image.height,
      bitsPerComponent: 8,
      bytesPerRow: image.width * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    )
  else {
    fail("Could not allocate a bitmap context for \(path)")
  }
  // A bitmap context exposes rows in the same top-to-bottom order used by the
  // JPEG and the resampled Vision mask.
  context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
  return (PixelImage(width: image.width, height: image.height, rgba: pixels), image)
}

private func makeCGImage(_ image: PixelImage) -> CGImage {
  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
  guard
    let provider = CGDataProvider(data: Data(image.rgba) as CFData),
    let output = CGImage(
      width: image.width,
      height: image.height,
      bitsPerComponent: 8,
      bitsPerPixel: 32,
      bytesPerRow: image.width * 4,
      space: colorSpace,
      bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue | CGBitmapInfo.byteOrder32Big.rawValue),
      provider: provider,
      decode: nil,
      shouldInterpolate: true,
      intent: .defaultIntent
    )
  else {
    fail("Could not construct output image")
  }
  return output
}

private func writeImage(_ image: PixelImage, to path: String, type: UTType, quality: Double? = nil) {
  let url = URL(fileURLWithPath: path)
  try? FileManager.default.createDirectory(
    at: url.deletingLastPathComponent(),
    withIntermediateDirectories: true
  )
  guard let destination = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil) else {
    fail("Could not create \(path)")
  }
  var properties: [CFString: Any] = [:]
  if let quality {
    properties[kCGImageDestinationLossyCompressionQuality] = quality
  }
  CGImageDestinationAddImage(destination, makeCGImage(image), properties as CFDictionary)
  if !CGImageDestinationFinalize(destination) {
    fail("Could not encode \(path)")
  }
}

private func rgbToHSV(_ red: UInt8, _ green: UInt8, _ blue: UInt8) -> HSV {
  let r = Double(red) / 255
  let g = Double(green) / 255
  let b = Double(blue) / 255
  let maximum = max(r, g, b)
  let minimum = min(r, g, b)
  let delta = maximum - minimum
  var hue = 0.0
  if delta > 0.0001 {
    if maximum == r {
      hue = 60 * ((g - b) / delta).truncatingRemainder(dividingBy: 6)
    } else if maximum == g {
      hue = 60 * ((b - r) / delta + 2)
    } else {
      hue = 60 * ((r - g) / delta + 4)
    }
    if hue < 0 { hue += 360 }
  }
  return HSV(h: hue, s: maximum == 0 ? 0 : delta / maximum, v: maximum)
}

private func srgbLinear(_ component: Double) -> Double {
  component <= 0.04045 ? component / 12.92 : pow((component + 0.055) / 1.055, 2.4)
}

private func rgbToLab(_ red: UInt8, _ green: UInt8, _ blue: UInt8) -> Lab {
  let r = srgbLinear(Double(red) / 255)
  let g = srgbLinear(Double(green) / 255)
  let b = srgbLinear(Double(blue) / 255)
  let x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  let y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b)
  let z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
  func f(_ value: Double) -> Double {
    value > 0.008856 ? pow(value, 1.0 / 3.0) : (7.787 * value + 16.0 / 116.0)
  }
  let fx = f(x)
  let fy = f(y)
  let fz = f(z)
  return Lab(l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz))
}

private func labDistance(_ left: Lab, _ right: Lab) -> Double {
  let dl = left.l - right.l
  let da = left.a - right.a
  let db = left.b - right.b
  return sqrt(dl * dl + da * da + db * db)
}

private func skinDistance(_ left: Lab, _ right: Lab) -> Double {
  let dl = (left.l - right.l) * 0.42
  let da = left.a - right.a
  let db = left.b - right.b
  return sqrt(dl * dl + da * da + db * db)
}

private func minimumDistance(_ sample: Lab, to centroids: [Lab], skinWeighted: Bool = false) -> Double {
  centroids.reduce(Double.greatestFiniteMagnitude) { current, centroid in
    min(current, skinWeighted ? skinDistance(sample, centroid) : labDistance(sample, centroid))
  }
}

private func pixelRGB(_ image: PixelImage, _ index: Int) -> (UInt8, UInt8, UInt8) {
  let offset = index * 4
  return (image.rgba[offset], image.rgba[offset + 1], image.rgba[offset + 2])
}

private func detectFaceAndPerson(in image: CGImage) -> (FaceBox, [UInt8]) {
  let faceRequest = VNDetectFaceRectanglesRequest()
  let personRequest = VNGeneratePersonSegmentationRequest()
  personRequest.qualityLevel = .accurate
  personRequest.outputPixelFormat = kCVPixelFormatType_OneComponent8
  // CPU execution is slower but deterministic and avoids changing behaviour with
  // the host's Neural Engine generation.
  guard let cpu = MLComputeDevice.allComputeDevices.first(where: {
    if case .cpu = $0 { return true }
    return false
  }) else {
    fail("Core ML did not expose a CPU compute device")
  }
  faceRequest.setComputeDevice(cpu, for: .main)
  personRequest.setComputeDevice(cpu, for: .main)
  let handler = VNImageRequestHandler(cgImage: image, orientation: .up)
  do {
    try handler.perform([faceRequest, personRequest])
  } catch {
    fail("Vision could not segment the portrait: \(error.localizedDescription)")
  }
  guard let face = faceRequest.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }) else {
    fail("Vision did not find one face")
  }
  guard let buffer = personRequest.results?.first?.pixelBuffer else {
    fail("Vision did not return a person mask")
  }
  let box = face.boundingBox
  let faceBox = FaceBox(
    minX: box.minX * Double(image.width),
    minY: (1 - box.maxY) * Double(image.height),
    maxX: box.maxX * Double(image.width),
    maxY: (1 - box.minY) * Double(image.height)
  )

  CVPixelBufferLockBaseAddress(buffer, .readOnly)
  defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
  guard let base = CVPixelBufferGetBaseAddress(buffer)?.assumingMemoryBound(to: UInt8.self) else {
    fail("Vision returned an unreadable person mask")
  }
  let maskWidth = CVPixelBufferGetWidth(buffer)
  let maskHeight = CVPixelBufferGetHeight(buffer)
  let stride = CVPixelBufferGetBytesPerRow(buffer)
  var mask = [UInt8](repeating: 0, count: image.width * image.height)
  for y in 0..<image.height {
    let maskY = Int((Double(y) / Double(image.height - 1)) * Double(maskHeight - 1))
    for x in 0..<image.width {
      let maskX = Int((Double(x) / Double(image.width - 1)) * Double(maskWidth - 1))
      mask[y * image.width + x] = base[maskY * stride + maskX]
    }
  }
  return (faceBox, mask)
}

private func kMeans(_ samples: [Lab], clusterCount: Int, iterations: Int = 12) -> [Lab] {
  guard !samples.isEmpty else { return [] }
  let count = min(clusterCount, samples.count)
  var centroids = (0..<count).map { samples[($0 * samples.count) / count] }
  for _ in 0..<iterations {
    var sums = Array(repeating: (l: 0.0, a: 0.0, b: 0.0, count: 0), count: count)
    for sample in samples {
      var best = 0
      var bestDistance = Double.greatestFiniteMagnitude
      for (index, centroid) in centroids.enumerated() {
        let distance = labDistance(sample, centroid)
        if distance < bestDistance {
          bestDistance = distance
          best = index
        }
      }
      sums[best].l += sample.l
      sums[best].a += sample.a
      sums[best].b += sample.b
      sums[best].count += 1
    }
    for index in 0..<count where sums[index].count > 0 {
      let divisor = Double(sums[index].count)
      centroids[index] = Lab(
        l: sums[index].l / divisor,
        a: sums[index].a / divisor,
        b: sums[index].b / divisor
      )
    }
  }
  return centroids
}

private func buildProtectionMasks(
  image: PixelImage,
  face: FaceBox,
  person: [UInt8]
) -> (skin: [Bool], hair: [Bool], skinCentroids: [Lab]) {
  let width = image.width
  let height = image.height
  var skin = [Bool](repeating: false, count: width * height)
  var hair = [Bool](repeating: false, count: width * height)

  var skinSamples: [Lab] = []
  let sampleRegions = [
    (
      minX: face.minX + face.width * 0.14,
      maxX: face.minX + face.width * 0.38,
      minY: face.minY + face.height * 0.43,
      maxY: face.minY + face.height * 0.70
    ),
    (
      minX: face.minX + face.width * 0.62,
      maxX: face.minX + face.width * 0.86,
      minY: face.minY + face.height * 0.43,
      maxY: face.minY + face.height * 0.70
    ),
    (
      minX: face.minX + face.width * 0.36,
      maxX: face.minX + face.width * 0.64,
      minY: face.minY + face.height * 0.17,
      maxY: face.minY + face.height * 0.31
    ),
  ]
  for region in sampleRegions {
    for y in Int(region.minY)...Int(region.maxY) where y >= 0 && y < height {
      for x in Int(region.minX)...Int(region.maxX) where x >= 0 && x < width {
        let index = y * width + x
        if (x + y) % 2 == 0 {
          let (r, g, b) = pixelRGB(image, index)
          skinSamples.append(rgbToLab(r, g, b))
        }
      }
    }
  }
  let skinCentroids = kMeans(skinSamples, clusterCount: 5)

  // Protect the full detected head first. Clothing only begins around the lower
  // face edge, so this deliberately favours identity preservation over coverage.
  let headMinX = Int(max(0, face.minX - face.width * 0.48))
  let headMaxX = Int(min(Double(width - 1), face.maxX + face.width * 0.48))
  let headMaxY = Int(min(Double(height - 1), face.maxY + 2))
  for y in 0...headMaxY {
    for x in headMinX...headMaxX {
      let index = y * width + x
      if person[index] > 42 { hair[index] = true }
    }
  }

  // Build deterministic hair colour centroids from the crown and both sides of
  // the face, then extend only those colours below the detected head. This keeps
  // long curls, braids and ponytails intact without treating a whole shoulder as
  // hair.
  var hairSamples: [Lab] = []
  let crownLimit = Int(face.minY + face.height * 0.24)
  let sideLimit = Int(face.maxY - face.height * 0.18)
  for y in 0..<min(height, sideLimit + 1) {
    for x in 0..<width {
      let index = y * width + x
      guard person[index] > 90 else { continue }
      let crown = y <= crownLimit
      let side = x < Int(face.minX + face.width * 0.08) || x > Int(face.maxX - face.width * 0.08)
      guard crown || side else { continue }
      if (x + 2 * y) % 4 == 0 {
        let (r, g, b) = pixelRGB(image, index)
        hairSamples.append(rgbToLab(r, g, b))
      }
    }
  }
  let hairCentroids = kMeans(hairSamples, clusterCount: 7)

  let hairStartY = max(0, Int(face.maxY - 10))
  var hairCandidate = [Bool](repeating: false, count: width * height)
  for y in hairStartY..<height {
    for x in 0..<width {
      let index = y * width + x
      guard person[index] > 75 else { continue }
      let sideInset = y < Int(face.maxY + 30) ? 0.12 : 0.24
      let outsideCore =
        x < Int(face.minX + face.width * sideInset) ||
        x > Int(face.maxX - face.width * sideInset)
      guard outsideCore else { continue }
      let (r, g, b) = pixelRGB(image, index)
      let lab = rgbToLab(r, g, b)
      if hairCentroids.contains(where: { labDistance(lab, $0) < 13.5 }) {
        hairCandidate[index] = true
      }
    }
  }

  // Only preserve lower hair that is actually connected to hair at the sides of
  // the detected head. Colour similarity by itself would confuse a dark maroon
  // shoulder with black hair on short-haired portraits.
  var queue: [Int] = []
  let seedMaxY = min(height - 1, Int(face.maxY + 4))
  if hairStartY <= seedMaxY {
    for y in hairStartY...seedMaxY {
      for x in 0..<width {
        let index = y * width + x
        if hairCandidate[index] {
          hair[index] = true
          queue.append(index)
        }
      }
    }
  }
  var cursor = 0
  while cursor < queue.count {
    let index = queue[cursor]
    cursor += 1
    let x = index % width
    let y = index / width
    for yy in max(hairStartY, y - 1)...min(height - 1, y + 1) {
      for xx in max(0, x - 1)...min(width - 1, x + 1) {
        let neighbor = yy * width + xx
        if hairCandidate[neighbor], !hair[neighbor] {
          hair[neighbor] = true
          queue.append(neighbor)
        }
      }
    }
  }

  // Protect only pixels that are strongly skin-like inside the neck corridor.
  // Garment masks below are learned independently from safe shoulder pixels, so
  // this is deliberately conservative rather than swallowing collar stitching.
  let neckMinX = Int(max(0, face.minX + face.width * 0.12))
  let neckMaxX = Int(min(Double(width - 1), face.maxX - face.width * 0.12))
  let neckStartY = max(0, Int(face.maxY - face.height * 0.16))
  for y in neckStartY..<height {
    let expansion = Double(y - neckStartY) * 0.08
    let minX = max(0, neckMinX - Int(expansion))
    let maxX = min(width - 1, neckMaxX + Int(expansion))
    for x in minX...maxX {
      let index = y * width + x
      guard person[index] > 75 else { continue }
      let (r, g, b) = pixelRGB(image, index)
      let lab = rgbToLab(r, g, b)
      if skinCentroids.contains(where: { skinDistance(lab, $0) < 12.2 }) {
        skin[index] = true
      }
    }
  }
  return (skin, hair, skinCentroids)
}

private func isHue(_ hue: Double, family: ShirtFamily) -> Bool {
  switch family {
  case .blue:
    return hue >= 182 && hue <= 258
  case .green:
    return hue >= 102 && hue <= 188
  case .maroon:
    return hue >= 312 || hue <= 18
  case .black:
    return false
  }
}

private func detectFamily(
  image: PixelImage,
  face: FaceBox,
  person: [UInt8],
  skin: [Bool],
  hair: [Bool]
) -> ShirtFamily {
  var scores: [ShirtFamily: Double] = [.blue: 0, .green: 0, .maroon: 0]
  var eligible = 0
  let startY = max(220, Int(face.maxY + 5))
  for y in startY..<image.height {
    for x in 0..<image.width {
      let index = y * image.width + x
      guard person[index] > 80, !skin[index], !hair[index] else { continue }
      let outerShoulder = x < Int(face.minX + 18) || x > Int(face.maxX - 18)
      guard outerShoulder || y > 268 else { continue }
      let (r, g, b) = pixelRGB(image, index)
      let hsv = rgbToHSV(r, g, b)
      guard hsv.s > 0.16, hsv.v > 0.055 else { continue }
      eligible += 1
      let weight = hsv.s * sqrt(hsv.v)
      if isHue(hsv.h, family: .blue) { scores[.blue, default: 0] += weight }
      if isHue(hsv.h, family: .green) { scores[.green, default: 0] += weight }
      if isHue(hsv.h, family: .maroon) { scores[.maroon, default: 0] += weight }
    }
  }
  guard eligible > 0, let winner = scores.max(by: { $0.value < $1.value }) else { return .black }
  return winner.value > Double(eligible) * 0.055 ? winner.key : .black
}

private func hasMaskNearby(_ mask: [UInt8], width: Int, height: Int, x: Int, y: Int, radius: Int) -> Bool {
  let minX = max(0, x - radius)
  let maxX = min(width - 1, x + radius)
  let minY = max(0, y - radius)
  let maxY = min(height - 1, y + radius)
  for yy in minY...maxY {
    for xx in minX...maxX where mask[yy * width + xx] > 80 {
      return true
    }
  }
  return false
}

private func normalize(_ source: PixelImage, cgImage: CGImage) -> (PixelImage, Analysis) {
  var output = source
  let (face, person) = detectFaceAndPerson(in: cgImage)
  let protection = buildProtectionMasks(image: source, face: face, person: person)
  let skin = protection.skin
  let hair = protection.hair
  let family = detectFamily(image: source, face: face, person: person, skin: skin, hair: hair)
  let width = source.width
  let height = source.height
  let startY = max(195, Int(face.maxY - 12))
  var baseMask = [UInt8](repeating: 0, count: width * height)
  func isOuterGarmentSample(x: Int, y: Int) -> Bool {
    let belowCollar = y >= max(232, Int(face.maxY + 14))
    let outsideNeck = x < Int(face.minX + 12) || x > Int(face.maxX - 12)
    return belowCollar && (outsideNeck || y >= 272)
  }

  var baseSamples: [Lab] = []
  if family != .black {
    for y in startY..<height {
      for x in 0..<width where isOuterGarmentSample(x: x, y: y) {
        let index = y * width + x
        guard person[index] > 90, !hair[index] else { continue }
        let (r, g, b) = pixelRGB(source, index)
        let hsv = rgbToHSV(r, g, b)
        if isHue(hsv.h, family: family), hsv.s > 0.11, hsv.v > 0.045, (x + y) % 2 == 0 {
          baseSamples.append(rgbToLab(r, g, b))
        }
      }
    }
  }
  let baseCentroids = kMeans(baseSamples, clusterCount: 8)
  var baseCandidate = [Bool](repeating: false, count: width * height)
  if family != .black, !baseCentroids.isEmpty {
    for y in startY..<height {
      for x in 0..<width {
        let index = y * width + x
        guard person[index] > 52 else { continue }
        let (r, g, b) = pixelRGB(source, index)
        let hsv = rgbToHSV(r, g, b)
        guard isHue(hsv.h, family: family), hsv.s > 0.075, hsv.v > 0.035 else { continue }
        let lab = rgbToLab(r, g, b)
        let garmentDistance = minimumDistance(lab, to: baseCentroids)
        let learnedSkinDistance = minimumDistance(lab, to: protection.skinCentroids, skinWeighted: true)
        if garmentDistance < 25, (!skin[index] || garmentDistance + 2.5 < learnedSkinDistance) {
          baseCandidate[index] = true
        }
      }
    }

    // Start from pixels in the guaranteed shoulder/chest zone, then retain only
    // the colour-consistent component connected to that garment. Similar skin or
    // hair colours elsewhere cannot become isolated false positives.
    var queue: [Int] = []
    for y in startY..<height {
      for x in 0..<width where isOuterGarmentSample(x: x, y: y) {
        let index = y * width + x
        if baseCandidate[index] {
          baseMask[index] = person[index]
          queue.append(index)
        }
      }
    }
    var cursor = 0
    while cursor < queue.count {
      let index = queue[cursor]
      cursor += 1
      let x = index % width
      let y = index / width
      for yy in max(startY, y - 1)...min(height - 1, y + 1) {
        for xx in max(0, x - 1)...min(width - 1, x + 1) {
          let neighbor = yy * width + xx
          if baseCandidate[neighbor], baseMask[neighbor] == 0 {
            baseMask[neighbor] = person[neighbor]
            queue.append(neighbor)
          }
        }
      }
    }

    var antialiased = baseMask
    for y in startY..<height {
      for x in 0..<width {
        let index = y * width + x
        guard
          antialiased[index] == 0,
          person[index] > 70,
          hasMaskNearby(baseMask, width: width, height: height, x: x, y: y, radius: 1)
        else { continue }
        let (r, g, b) = pixelRGB(source, index)
        let lab = rgbToLab(r, g, b)
        let garmentDistance = minimumDistance(lab, to: baseCentroids)
        let learnedSkinDistance = minimumDistance(lab, to: protection.skinCentroids, skinWeighted: true)
        if garmentDistance < 31, garmentDistance + 1 < learnedSkinDistance {
          antialiased[index] = UInt8(clamp(Double(person[index]) * 0.88, 0, 255))
        }
      }
    }
    baseMask = antialiased
  }

  var changed = 0
  for index in 0..<(width * height) {
    let baseAlpha = Double(baseMask[index]) / 255
    let alpha = baseAlpha
    guard alpha > 0 else { continue }
    let offset = index * 4
    let r = source.rgba[offset]
    let g = source.rgba[offset + 1]
    let b = source.rgba[offset + 2]
    let hsv = rgbToHSV(r, g, b)
    // A cool, neutral charcoal. Source value is retained to preserve folds and
    // portrait lighting; the common piping is outside the edit mask.
    let targetValue = clamp(0.012 + 0.76 * hsv.v, 0.065, 0.40)
    let targetR = targetValue * 0.91
    let targetG = targetValue * 0.96
    let targetB = targetValue
    let blend = clamp(alpha, 0, 1)
    output.rgba[offset] = UInt8(clamp((1 - blend) * Double(r) + blend * targetR * 255, 0, 255))
    output.rgba[offset + 1] = UInt8(clamp((1 - blend) * Double(g) + blend * targetG * 255, 0, 255))
    output.rgba[offset + 2] = UInt8(clamp((1 - blend) * Double(b) + blend * targetB * 255, 0, 255))
    changed += 1
  }

  return (
    output,
    Analysis(
      family: family,
      baseMask: baseMask,
      skinMask: skin,
      hairMask: hair,
      changedPixels: changed
    )
  )
}

private func debugImage(source: PixelImage, analysis: Analysis) -> PixelImage {
  var output = source
  for index in 0..<(source.width * source.height) {
    let offset = index * 4
    var overlay: (Double, Double, Double)?
    var alpha = 0.0
    if analysis.baseMask[index] > 0 {
      overlay = (0, 0.90, 1)
      alpha = 0.62 * Double(analysis.baseMask[index]) / 255
    }
    if analysis.skinMask[index] {
      overlay = (1, 0.78, 0)
      alpha = 0.22
    } else if analysis.hairMask[index] {
      overlay = (1, 0.18, 0.08)
      alpha = 0.18
    }
    guard let overlay else { continue }
    output.rgba[offset] = UInt8((1 - alpha) * Double(output.rgba[offset]) + alpha * overlay.0 * 255)
    output.rgba[offset + 1] = UInt8((1 - alpha) * Double(output.rgba[offset + 1]) + alpha * overlay.1 * 255)
    output.rgba[offset + 2] = UInt8((1 - alpha) * Double(output.rgba[offset + 2]) + alpha * overlay.2 * 255)
  }
  return output
}

guard CommandLine.arguments.count == 2 else {
  fail("Usage: normalize-portrait-clothing.swift /absolute/path/to/worklist.json")
}
private let workListURL = URL(fileURLWithPath: CommandLine.arguments[1])
private let workList: WorkList
do {
  workList = try JSONDecoder().decode(WorkList.self, from: Data(contentsOf: workListURL))
} catch {
  fail("Could not read worklist: \(error.localizedDescription)")
}
guard !workList.items.isEmpty else { fail("Worklist is empty") }

for (position, item) in workList.items.enumerated() {
  let (source, cgImage) = loadImage(item.source)
  let (normalized, analysis) = normalize(source, cgImage: cgImage)
  let share = Double(analysis.changedPixels) / Double(source.width * source.height)
  if (analysis.family != .black && share < 0.003) || share > 0.43 {
    fail(
      "\(item.id) detected \(analysis.family.rawValue) and selected an unsafe " +
        "\(String(format: "%.1f", share * 100))% of pixels"
    )
  }
  writeImage(normalized, to: item.destination, type: .jpeg, quality: jpegQuality)
  if let debugMask = item.debugMask {
    writeImage(debugImage(source: source, analysis: analysis), to: debugMask, type: .png)
  }
  print(
    "[portrait-clothing] \(position + 1)/\(workList.items.count) \(item.id): " +
      "\(analysis.family.rawValue), \(String(format: "%.1f", share * 100))% garment pixels"
  )
}
