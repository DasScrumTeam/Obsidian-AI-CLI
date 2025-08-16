param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

# GitHub Release Script for Obsidian Plugin
# Usage: .\release.ps1 -Version "1.0.0"

Write-Host "Creating release for version $Version..." -ForegroundColor Green

$ReleaseDir = "release-$Version"
$ChangelogFile = "CHANGELOG.md"

# Check if required files exist
$RequiredFiles = @("main.js", "manifest.json", "styles.css")
foreach ($file in $RequiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Error "Error: $file not found. Please run 'npm run build' first if needed."
        exit 1
    }
}

if (-not (Test-Path $ChangelogFile)) {
    Write-Error "Error: $ChangelogFile not found."
    exit 1
}

# Create release directory
if (Test-Path $ReleaseDir) {
    Remove-Item $ReleaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $ReleaseDir | Out-Null

# Copy release files
Write-Host "Copying release files..." -ForegroundColor Yellow
foreach ($file in $RequiredFiles) {
    Copy-Item $file -Destination $ReleaseDir
    Write-Host "  ✓ Copied $file" -ForegroundColor Gray
}

# Create zip file
Write-Host "Creating release archive..." -ForegroundColor Yellow
$ZipPath = "$ReleaseDir.zip"
Compress-Archive -Path "$ReleaseDir\*" -DestinationPath $ZipPath -Force
Write-Host "  ✓ Created $ZipPath" -ForegroundColor Gray

# Extract release notes from CHANGELOG.md
Write-Host "Extracting release notes from $ChangelogFile..." -ForegroundColor Yellow
$ReleaseNotesFile = "release-notes-$Version.md"

try {
    $content = Get-Content $ChangelogFile -Raw
    $pattern = "(?s)## \[$Version\].*?\n(.*?)(?=\n## \[|\n# |$)"
    
    if ($content -match $pattern) {
        $matches[1].Trim() | Out-File -FilePath $ReleaseNotesFile -Encoding UTF8
        Write-Host "  ✓ Extracted release notes to $ReleaseNotesFile" -ForegroundColor Gray
    } else {
        "Release notes for version $Version" | Out-File -FilePath $ReleaseNotesFile -Encoding UTF8
        Write-Host "  ⚠ No specific release notes found, using default" -ForegroundColor Yellow
    }
} catch {
    Write-Error "Error extracting release notes: $_"
    exit 1
}

# Check if gh CLI is available
try {
    gh --version | Out-Null
    $ghAvailable = $true
} catch {
    $ghAvailable = $false
}

if (-not $ghAvailable) {
    Write-Warning "GitHub CLI (gh) not found. Please install it to create releases automatically."
    Write-Host "`nManual steps:" -ForegroundColor Cyan
    Write-Host "1. Create a new release on GitHub with tag: v$Version" -ForegroundColor White
    Write-Host "2. Upload the file: $ZipPath" -ForegroundColor White
    Write-Host "3. Use the release notes from: $ReleaseNotesFile" -ForegroundColor White
    return
}

# Create GitHub release
Write-Host "Creating GitHub release..." -ForegroundColor Yellow
try {
    gh release create "v$Version" $ZipPath --title "Release v$Version" --notes-file $ReleaseNotesFile
    Write-Host "✓ Release v$Version created successfully!" -ForegroundColor Green
    Write-Host "✓ Archive: $ZipPath" -ForegroundColor Green
} catch {
    Write-Error "Failed to create GitHub release: $_"
    exit 1
} finally {
    # Clean up temporary files
    if (Test-Path $ReleaseNotesFile) {
        Remove-Item $ReleaseNotesFile
    }
}

Write-Host "`nDone! 🚀" -ForegroundColor Green