require "json"

podspec_dir = File.dirname(File.expand_path(__FILE__))
package = JSON.parse(File.read(File.join(podspec_dir, "package.json")))

Pod::Spec.new do |s|
  s.name             = "NitroUpdateBundleManager"
  s.version          = package["version"]
  s.summary          = "Standalone bundle manager for NitroUpdate without C++ interop"
  s.homepage         = package["homepage"]
  s.license          = package["license"]
  s.authors          = package["author"]

  s.platforms        = { :ios => "13.0" }
  s.source           = { :git => "https://github.com/your-org/react-native-nitro-update.git", :tag => "#{s.version}" }

  s.source_files     = "NitroIsolatedBundle/NitroUpdateBundleManager.swift"
  s.module_name      = "NitroUpdateBundleManager"
  s.swift_version    = "5.0"
end
