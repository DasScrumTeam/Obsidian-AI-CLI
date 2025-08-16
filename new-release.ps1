#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Automate the creation of a new release for the Obsidian AI CLI plugin
.DESCRIPTION
    This script automates the release process by:
    1. Prompting for the new version number
    2. Updating version in manifest.json, package.json, and versions.json
    3. Building the plugin
    4. Creating a git tag
    5. Creating a GitHub release with changelog and release files
.PARAMETER Version
    The new version number (e.g., "1.0.3")
.PARAMETER SkipBuild
    Skip the build step (useful if already built)
.EXAMPLE
    .\new-release.ps1 -Version "1.0.3"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    
    [switch]$SkipBuild
)

# Color output functions
function Write-Success($message) { Write-Host $message -ForegroundColor Green }
function Write-Error($message) { Write-Host $message -ForegroundColor Red }
function Write-Info($message) { Write-Host $message -ForegroundColor Cyan }
function Write-Warning($message) { Write-Host $message -ForegroundColor Yellow }

# Validate version format
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Invalid version format. Please use semantic versioning (e.g., 1.0.3)"
    exit 1
}

Write-Info "Starting release process for version $Version"

# Check if we're in the right directory
if (-not (Test-Path "manifest.json")) {
    Write-Error "manifest.json not found. Please run this script from the plugin root directory."
    exit 1
}

# Check if git is clean
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Warning "Git working directory is not clean:"
    Write-Host $gitStatus
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Info "Aborting release."
        exit 1
    }
}

try {
    # Update manifest.json
    Write-Info "Updating manifest.json..."
    $manifest = Get-Content "manifest.json" | ConvertFrom-Json
    $oldVersion = $manifest.version
    $manifest.version = $Version
    $manifest | ConvertTo-Json -Depth 10 | Set-Content "manifest.json"
    Write-Success "Updated manifest.json: $oldVersion -> $Version"

    # Update package.json
    Write-Info "Updating package.json..."
    $package = Get-Content "package.json" | ConvertFrom-Json
    $package.version = $Version
    $package | ConvertTo-Json -Depth 10 | Set-Content "package.json"
    Write-Success "Updated package.json: $oldVersion -> $Version"

    # Update versions.json
    Write-Info "Updating versions.json..."
    $versions = Get-Content "versions.json" | ConvertFrom-Json
    $minAppVersion = $versions.PSObject.Properties.Value | Select-Object -Last 1
    $versions | Add-Member -MemberType NoteProperty -Name $Version -Value $minAppVersion -Force
    $versions | ConvertTo-Json -Depth 10 | Set-Content "versions.json"
    Write-Success "Updated versions.json with version $Version"

    # Build the plugin
    if (-not $SkipBuild) {
        Write-Info "Building plugin..."
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed"
        }
        Write-Success "Build completed successfully"
    } else {
        Write-Warning "Skipping build step"
    }

    # Verify required files exist
    $requiredFiles = @("main.js", "manifest.json", "styles.css")
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            throw "Required file $file not found"
        }
    }
    Write-Success "All required files present: $($requiredFiles -join ', ')"

    # Extract changelog for this version
    Write-Info "Extracting changelog..."
    $changelogContent = Get-Content "CHANGELOG.md" -Raw
    
    # Find the section for this version or unreleased
    $versionPattern = "## \[(?:Unreleased|$([regex]::Escape($Version)))\]"
    $nextVersionPattern = "## \[\d+\.\d+\.\d+\]"
    
    if ($changelogContent -match "(?s)($versionPattern.*?)(?=$nextVersionPattern|$)") {
        $changelogSection = $matches[1].Trim()
        # Remove the version header for the release notes
        $releaseNotes = $changelogSection -replace "^## \[.*?\].*?\n", ""
        $releaseNotes = $releaseNotes.Trim()
        
        if (-not $releaseNotes) {
            $releaseNotes = "No specific changes documented for this release."
        }
    } else {
        Write-Warning "Could not find changelog section for version $Version"
        $releaseNotes = "See CHANGELOG.md for details."
    }

    # Update CHANGELOG.md if using Unreleased section
    if ($changelogContent -match "## \[Unreleased\]") {
        Write-Info "Updating CHANGELOG.md..."
        $currentDate = Get-Date -Format "yyyy-MM-dd"
        $updatedChangelog = $changelogContent -replace "## \[Unreleased\]", "## [Unreleased]`n`n### Added`n`n### Changed`n`n### Deprecated`n`n### Removed`n`n### Fixed`n`n### Security`n`n## [$Version] - $currentDate"
        Set-Content "CHANGELOG.md" $updatedChangelog
        Write-Success "Updated CHANGELOG.md with new version entry"
    }

    # Commit changes
    Write-Info "Committing version updates..."
    git add manifest.json package.json versions.json CHANGELOG.md
    git commit -m "Release version $Version"
    Write-Success "Committed version updates"

    # Create git tag
    Write-Info "Creating git tag..."
    git tag -a "v$Version" -m "Release version $Version"
    Write-Success "Created git tag v$Version"

    # Check if gh CLI is available
    $ghAvailable = Get-Command gh -ErrorAction SilentlyContinue
    if ($ghAvailable) {
        Write-Info "Creating GitHub release..."
        
        # Create temporary release notes file
        $releaseNotesFile = "release-notes-temp.md"
        Set-Content $releaseNotesFile $releaseNotes
        
        try {
            # Create GitHub release with files
            gh release create "v$Version" `
                --title "Release $Version" `
                --notes-file $releaseNotesFile `
                main.js manifest.json styles.css
            
            Write-Success "Created GitHub release v$Version"
        } finally {
            # Clean up temp file
            if (Test-Path $releaseNotesFile) {
                Remove-Item $releaseNotesFile
            }
        }
        
        # Ask if user wants to push
        $push = Read-Host "Push changes and tags to remote? (Y/n)"
        if ($push -ne "n" -and $push -ne "N") {
            git push origin master
            git push origin "v$Version"
            Write-Success "Pushed changes and tags to remote"
        }
    } else {
        Write-Warning "GitHub CLI (gh) not found. Manual steps required:"
        Write-Host "1. Push changes: git push origin master"
        Write-Host "2. Push tags: git push origin v$Version"
        Write-Host "3. Create GitHub release manually with files: main.js, manifest.json, styles.css"
        Write-Host ""
        Write-Host "Release notes:"
        Write-Host $releaseNotes
    }

    Write-Success "`nRelease $Version completed successfully!"
    Write-Info "Release files: main.js, manifest.json, styles.css"

} catch {
    Write-Error "Release process failed: $_"
    Write-Warning "You may need to manually revert version changes if the process was interrupted."
    exit 1
}