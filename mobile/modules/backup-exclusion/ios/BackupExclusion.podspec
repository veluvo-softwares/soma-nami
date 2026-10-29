Pod::Spec.new do |s|
  s.name           = 'BackupExclusion'
  s.version        = '1.0.0'
  s.summary        = 'Marks a file or folder as excluded from iCloud and iTunes backup.'
  s.description    = 'Sets NSURLIsExcludedFromBackupKey. Local to Soma Nami.'
  s.author         = 'Veluvo Softwares'
  s.homepage       = 'https://github.com/veluvo-softwares/soma-nami'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  s.source_files = '**/*.{h,m,mm,swift}'
end
