# frozen_string_literal: true

# NitroUpdatePodUtils
#
# Podfile helper for react-native-nitro-update.
# Fixes Swift build settings that break with react-native-nitro-modules.
#
# Usage (add to Podfile post_install):
#
#   require_relative '../node_modules/react-native-nitro-update/scripts/nitro_update_pod_utils'
#
#   post_install do |installer|
#     react_native_post_install(installer, ...)
#     NitroUpdatePodUtils.apply!(installer)
#   end

module NitroUpdatePodUtils
  class << self
    # Apply all NitroUpdate fixes to the installer.
    #
    # @param installer [Pod::Installer] CocoaPods installer instance
    # @param app_project_name [String, nil] Optional app project name (e.g. "MyApp")
    #   If nil, attempts to detect automatically.
    def apply!(installer, app_project_name: nil)
      fix_pods_project(installer)
      fix_generated_projects(installer)
      fix_app_project(installer, app_project_name)
    end

    private

    # Fix SWIFT_ACTIVE_COMPILATION_CONDITIONS in all pods.
    def fix_pods_project(installer)
      return unless installer.respond_to?(:pods_project) && installer.pods_project

      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          sanitize_swift_conditions(config)
          ensure_cxx_settings(config)
        end
      end
    end

    # Fix generated projects (umbrella projects).
    def fix_generated_projects(installer)
      return unless installer.respond_to?(:generated_projects)

      installer.generated_projects&.each do |project|
        project.targets.each do |target|
          target.build_configurations.each do |config|
            sanitize_swift_conditions(config)
            ensure_cxx_settings(config)
          end
        end
      end
    end

    # Fix app project Swift settings.
    def fix_app_project(installer, app_project_name)
      installation_root = Pod::Config.instance.installation_root
      app_dir = File.dirname(installation_root)

      project_path = if app_project_name
                       File.join(app_dir, "#{app_project_name}.xcodeproj")
                     else
                       detect_app_project(app_dir)
                     end

      return unless project_path && File.exist?(project_path)

      begin
        app_project = Xcodeproj::Project.open(project_path)
        modified = false

        app_project.native_targets.each do |target|
          target.build_configurations.each do |config|
            modified |= sanitize_swift_conditions(config)
            modified |= ensure_cxx_settings(config)
          end
        end

        # Also fix project-level build settings
        app_project.build_configurations.each do |config|
          modified |= sanitize_swift_conditions(config)
        end

        app_project.save if modified
      rescue StandardError => e
        Pod::UI.warn "[NitroUpdatePodUtils] Could not fix app project: #{e.message}"
      end
    end

    # Detect app xcodeproj in directory.
    def detect_app_project(dir)
      projects = Dir.glob(File.join(dir, '*.xcodeproj'))
      projects.reject { |p| p.include?('Pods.xcodeproj') }.first
    end

    # Sanitize SWIFT_ACTIVE_COMPILATION_CONDITIONS.
    #
    # SWIFT_ACTIVE_COMPILATION_CONDITIONS must only contain Swift identifiers
    # (e.g. DEBUG, RELEASE). Compiler flags like -D must go in OTHER_SWIFT_FLAGS.
    #
    # @return [Boolean] true if changes were made
    def sanitize_swift_conditions(config)
      conditions = config.build_settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS']
      return false unless conditions

      raw = conditions.is_a?(Array) ? conditions.join(' ') : conditions.to_s
      tokens = raw.split

      # Separate valid identifiers from flags
      idents = tokens.reject { |t| t.start_with?('-') || t.match?(/^\d/) }
      flags = tokens.select { |t| t.start_with?('-') }

      return false if flags.empty?

      # Update SWIFT_ACTIVE_COMPILATION_CONDITIONS with only identifiers
      config.build_settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] =
        idents.empty? ? '$(inherited)' : idents.join(' ')

      # Move flags to OTHER_SWIFT_FLAGS
      other = config.build_settings['OTHER_SWIFT_FLAGS'] || '$(inherited)'
      other_clean = sanitize_other_swift_flags(other)
      config.build_settings['OTHER_SWIFT_FLAGS'] = "#{other_clean} #{flags.join(' ')}".strip

      true
    end

    # Sanitize OTHER_SWIFT_FLAGS to remove dangling -D flags.
    #
    # @param flags [String] Current OTHER_SWIFT_FLAGS value
    # @return [String] Cleaned flags
    def sanitize_other_swift_flags(flags)
      return '$(inherited)' unless flags

      raw = flags.is_a?(Array) ? flags.join(' ') : flags.to_s
      tokens = raw.split

      result = []
      skip_next = false

      tokens.each_with_index do |token, idx|
        if skip_next
          skip_next = false
          next
        end

        if token == '-D'
          # Check if next token exists and is a valid identifier
          next_token = tokens[idx + 1]
          if next_token && !next_token.start_with?('-') && next_token.match?(/^[A-Za-z_][A-Za-z0-9_]*$/)
            result << "-D#{next_token}"
            skip_next = true
          end
          # Otherwise, skip the dangling -D
        elsif token.start_with?('-D') && token.length > 2
          # Already combined -DFOO form, keep it
          result << token
        else
          result << token
        end
      end

      result.empty? ? '$(inherited)' : result.join(' ')
    end

    # Ensure C++20 and libc++ settings.
    #
    # @return [Boolean] true if changes were made
    def ensure_cxx_settings(config)
      modified = false

      if config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] != 'c++20'
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
        modified = true
      end

      if config.build_settings['CLANG_CXX_STANDARD_LIBRARY'] != 'libc++'
        config.build_settings['CLANG_CXX_STANDARD_LIBRARY'] = 'libc++'
        modified = true
      end

      modified
    end
  end
end
