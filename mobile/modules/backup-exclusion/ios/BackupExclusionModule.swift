import ExpoModulesCore

/// Sets NSURLIsExcludedFromBackupKey on a file or folder so iCloud and iTunes
/// backups skip it. A folder's contents are skipped with it.
/// https://developer.apple.com/documentation/foundation/nsurlisexcludedfrombackupkey
public class BackupExclusionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BackupExclusion")

    Function("excludeFromBackup") { (uri: String) throws in
      guard var url = URL(string: uri), url.isFileURL else {
        throw Exception(name: "ERR_BACKUP_EXCLUSION", description: "Not a file URI")
      }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
    }
  }
}
