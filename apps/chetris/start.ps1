# CHATRIS 플로팅 위젯 실행 스크립트
# 우하단에 항상 최상단으로 띄움

$ErrorActionPreference = "SilentlyContinue"

# --- 설정 ---
$port = 3000
$width = 380
$height = 630

# 화면 크기 감지 → 우하단 배치
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$posX = $screen.Width - $width - 20
$posY = $screen.Height - $height - 20

Write-Host "CHATRIS - 플로팅 위젯 시작 중..." -ForegroundColor Cyan

# 1) 로컬 서버 시작 (이미 실행 중이면 스킵)
$existing = Get-NetTCPConnection -LocalPort $port -State Listen 2>$null
if (-not $existing) {
    Write-Host "  서버 시작 (port $port)..." -ForegroundColor Yellow
    $serverDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    Start-Process -WindowStyle Hidden -FilePath "npx" -ArgumentList "serve `"$serverDir`" -l $port --no-clipboard" -WorkingDirectory $serverDir
    Start-Sleep -Seconds 2
} else {
    Write-Host "  서버 이미 실행 중" -ForegroundColor Green
}

# 2) Chrome 앱모드로 열기
Write-Host "  Chrome 앱모드 실행..." -ForegroundColor Yellow
$chromeArgs = "--app=http://localhost:$port --window-size=$width,$height --window-position=$posX,$posY --disable-extensions --disable-sync"

# Chrome 경로 탐색
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromePath = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList $chromeArgs
} else {
    Start-Process "chrome" -ArgumentList $chromeArgs
}

Start-Sleep -Seconds 2

# 3) 항상 최상단 고정 (SetWindowPos API)
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinAPI {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
}
"@

$HWND_TOPMOST = [IntPtr]::new(-1)
$SWP_NOMOVE = 0x0002
$SWP_NOSIZE = 0x0001
$SWP_SHOWWINDOW = 0x0040

# "CHATRIS" 타이틀의 창 찾기
$found = $false
$callback = [WinAPI+EnumWindowsProc]{
    param($hWnd, $lParam)
    $sb = New-Object System.Text.StringBuilder 256
    [WinAPI]::GetWindowText($hWnd, $sb, 256) | Out-Null
    $title = $sb.ToString()
    if ($title -match "CHATRIS" -and [WinAPI]::IsWindowVisible($hWnd)) {
        [WinAPI]::SetWindowPos($hWnd, $HWND_TOPMOST, 0, 0, 0, 0, $SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_SHOWWINDOW)
        $script:found = $true
        Write-Host "  항상 위에 고정 완료!" -ForegroundColor Green
    }
    return $true
}
[WinAPI]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null

if (-not $found) {
    Write-Host "  창을 찾지 못했습니다. 수동으로 고정하세요." -ForegroundColor Red
}

Write-Host ""
Write-Host "CHATRIS 실행 완료! 키보드를 치면 가속됩니다." -ForegroundColor Cyan
Write-Host "종료하려면 Chrome 창을 닫으세요." -ForegroundColor DarkGray
