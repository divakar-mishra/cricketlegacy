require 'fileutils'
require 'xcodeproj'

# Build only a UI-test runner, never a replacement game binary. Use a new output
# directory so prior native results and the other agent's workspace are retained.
root = File.expand_path(ARGV.fetch(0))
raise 'Use a new directory below output/ios-device' unless root.start_with?(File.expand_path('../../output/ios-device/', __dir__) + '/')
raise 'Output directory already exists' if File.exist?(root)
FileUtils.mkdir_p(root)
FileUtils.cp(File.join(__dir__, 'DeviceRecoveryTests.swift'), File.join(root, 'DeviceRecoveryTests.swift'))
project = Xcodeproj::Project.new(File.join(root, 'CricketDeviceQA.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'CricketDeviceQA', :ios, '16.4')
source = project.main_group.new_file('DeviceRecoveryTests.swift')
target.source_build_phase.add_file_reference(source)
target.build_configurations.each do |configuration|
  settings = configuration.build_settings
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.coverdrive.cricket.deviceqatests'
  settings['SWIFT_VERSION'] = '5.0'
  settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  settings['DEVELOPMENT_TEAM'] = '25PTZT5DNC'
  settings['CODE_SIGN_STYLE'] = 'Automatic'
  settings['CODE_SIGN_IDENTITY'] = 'Apple Development'
  settings['TARGETED_DEVICE_FAMILY'] = '1'
  settings['INFOPLIST_KEY_CFBundleDisplayName'] = 'Cricket UI QA'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'CricketDeviceQA', true)
puts "Prepared app-only UI-test runner: #{root}"
