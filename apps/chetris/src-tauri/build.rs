#[cfg(windows)]
fn main() {
    // Windows에서는 최고 가용 관리자 권한으로 실행되도록 커스텀 매니페스트를 임베드한다.
    let manifest_str = r#"
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/>
    </dependentAssembly>
  </dependency>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="highestAvailable" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>
"#;

    let windows = tauri_build::WindowsAttributes::new().app_manifest(manifest_str);

    tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
        .expect("failed to run tauri build script");
}

#[cfg(not(windows))]
fn main() {
    // Windows 이외 플랫폼은 기존 기본 빌드 동작을 유지한다.
    tauri_build::build();
}
