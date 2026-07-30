param(
  [string]$VaultRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"
$classNotesRoot = Join-Path $VaultRoot "Class Notes"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$headingPattern = '\[\[([^\]|]+?)#\^v(\d+)\|([^\]|]+?)\s+(\d+):(\d+)-(\d+)\]\]'
$embedPattern = '!\[\[([^\]]+?)#\^v(\d+)\]\]'
$changedFiles = 0
$expandedRanges = 0
$insertedEmbeds = 0

Get-ChildItem -LiteralPath $classNotesRoot -Recurse -File -Filter "*.md" |
  ForEach-Object {
    $path = $_.FullName
    $lines = [System.Collections.Generic.List[string]]::new()
    [System.IO.File]::ReadAllLines($path) | ForEach-Object { $lines.Add($_) }
    $fileChanged = $false

    for ($i = $lines.Count - 1; $i -ge 0; $i--) {
      $match = [regex]::Match($lines[$i], $headingPattern)
      if (-not $match.Success) {
        continue
      }

      $target = $match.Groups[1].Value
      $anchorVerse = [int]$match.Groups[2].Value
      $startVerse = [int]$match.Groups[5].Value
      $endVerse = [int]$match.Groups[6].Value
      if ($anchorVerse -ne $startVerse -or $endVerse -lt $startVerse) {
        continue
      }

      $blockEnd = $i + 1
      $existingVerses = [System.Collections.Generic.List[int]]::new()
      $embedIndent = $null
      while ($blockEnd -lt $lines.Count) {
        $embedMatch = [regex]::Match($lines[$blockEnd], $embedPattern)
        if ($embedMatch.Success) {
          $existingVerses.Add([int]$embedMatch.Groups[2].Value)
          if ($null -eq $embedIndent) {
            $embedIndent = [regex]::Match($lines[$blockEnd], '^\s*').Value
          }
          $blockEnd++
          continue
        }
        if ([string]::IsNullOrWhiteSpace($lines[$blockEnd])) {
          $blockEnd++
          continue
        }
        break
      }

      $expectedVerses = @($startVerse..$endVerse)
      $alreadyComplete = $existingVerses.Count -eq $expectedVerses.Count
      if ($alreadyComplete) {
        for ($v = 0; $v -lt $expectedVerses.Count; $v++) {
          if ($existingVerses[$v] -ne $expectedVerses[$v]) {
            $alreadyComplete = $false
            break
          }
        }
      }
      if ($alreadyComplete) {
        continue
      }

      if ($null -eq $embedIndent) {
        $headingIndent = [regex]::Match($lines[$i], '^\s*').Value
        $embedIndent = "$headingIndent  "
      }

      $removeCount = $blockEnd - ($i + 1)
      if ($removeCount -gt 0) {
        $lines.RemoveRange($i + 1, $removeCount)
      }

      $replacement = [System.Collections.Generic.List[string]]::new()
      $replacement.Add("")
      foreach ($verse in $expectedVerses) {
        $replacement.Add("$embedIndent![[$target#^v$verse]]")
      }
      $replacement.Add("")
      $lines.InsertRange($i + 1, $replacement)

      $insertedEmbeds += $expectedVerses.Count - $existingVerses.Count
      $expandedRanges++
      $fileChanged = $true
    }

    if ($fileChanged) {
      [System.IO.File]::WriteAllLines($path, $lines, $utf8NoBom)
      $changedFiles++
    }
  }

Write-Host "Expanded $expandedRanges scripture ranges in $changedFiles class-note files."
Write-Host "Net new embedded verses: $insertedEmbeds"
