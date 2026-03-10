require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NitroUpdate"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => defined?(min_ios_version_supported) ? min_ios_version_supported : '13.0' }
  s.source       = { :git => "https://github.com/fullsnack-DEV/react-native-nitro-update.git", :tag => "v#{s.version}" }

  s.source_files = [
    "ios/**/*.{swift,h,m,mm}",
    "cpp/**/*.{hpp,cpp}",
  ]

  s.public_header_files = "ios/**/*.h"

  s.dependency 'NitroUpdateBundleManager', s.version.to_s
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  s.dependency 'React-Core'

  nitrogen_path = File.join(__dir__, 'nitrogen/generated/ios/NitroUpdate+autolinking.rb')
  if File.exist?(nitrogen_path)
    load nitrogen_path
    add_nitrogen_files(s) if defined?(add_nitrogen_files)
  end

  install_modules_dependencies(s) if defined?(install_modules_dependencies)
end
