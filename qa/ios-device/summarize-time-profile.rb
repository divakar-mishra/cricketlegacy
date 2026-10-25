require 'json'
require 'rexml/document'

# Read only a direct xctrace time-profile table export. Omit device/account IDs,
# raw stacks and app storage. Statistical CPU samples cannot prove input latency,
# blocked/waiting-thread duration, or that the owner reproduced a missed tap.
document = REXML::Document.new(File.read(ARGV.fetch(0)))
ids = {}
document.elements.each('//*') do |element|
  ids[element.attributes['id']] = element if element.attributes['id']
end
resolve = lambda do |element|
  element && (element.attributes['ref'] ? ids.fetch(element.attributes['ref']) : element)
end
threads = Hash.new do |hash, key|
  hash[key] = { samples: 0, weight_ns: 0, times: [], states: Hash.new(0), frames: Hash.new(0) }
end
times = []
document.elements.each('//row') do |row|
  thread = resolve.call(row.elements['thread'])
  weight = resolve.call(row.elements['weight'])
  time = resolve.call(row.elements['sample-time'])
  next unless thread && weight && time
  timestamp = time.text.to_i
  times << timestamp
  label = thread.attributes['fmt'].to_s
  name = if label.include?('Main Thread')
           'main'
         elsif label.include?('com.facebook.react.runtime.JavaScript')
           'javascript'
         else
           'other-app-thread'
         end
  group = threads[name]
  sample_weight = weight.text.to_i
  group[:samples] += 1
  group[:weight_ns] += sample_weight
  group[:times] << timestamp
  state = resolve.call(row.elements['thread-state'])
  group[:states][state.text] += sample_weight if state
  stack = resolve.call(row.elements['tagged-backtrace'])
  backtrace = resolve.call(stack && stack.elements['backtrace'])
  next unless backtrace
  frame_names = []
  backtrace.elements.each('frame') do |frame|
    frame_names << resolve.call(frame).attributes['name'].to_s
  end
  # Deduplicate recursive/repeated frames within each sample.
  frame_names.uniq.each do |frame|
    next if frame.match?(/^0x[0-9a-f]+$/i)
    group[:frames][frame] += sample_weight
  end
end
abort 'No time-profile samples; do not report an empty export as healthy.' if times.empty?

puts JSON.pretty_generate(
  interpretation: 'Statistical CPU sample weights, not touch latency, wall-clock stalls or proof of manual reproduction.',
  sample_span_seconds: (times.max - times.min) / 1e9,
  threads: threads.map do |name, group|
    buckets = group[:times].group_by { |time| time / 100_000_000 }
    {
      name: name,
      samples: group[:samples],
      sample_weight_ms: group[:weight_ns] / 1e6,
      states_sample_weight_ms: group[:states].transform_values { |value| value / 1e6 },
      peak_samples_in_aligned_100ms_bucket: buckets.values.map(&:length).max,
      top_inclusive_frames: group[:frames].sort_by { |_, value| -value }.first(12).map do |frame, value|
        { name: frame, sample_weight_ms: value / 1e6 }
      end,
    }
  end,
)
