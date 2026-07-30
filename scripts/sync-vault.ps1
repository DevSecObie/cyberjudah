param(
  [string]$VaultRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"
$websiteRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$contentRoot = Join-Path $websiteRoot "content"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if ((Split-Path $websiteRoot -Leaf) -ne "Website") {
  throw "Safety check failed: expected the project folder to be named Website."
}

New-Item -ItemType Directory -Force -Path $contentRoot | Out-Null

$publishedFolders = @("Bible", "Study Bible", "Encyclopedia", "Class Notes", "Classroom")
foreach ($folder in $publishedFolders) {
  $target = Join-Path $contentRoot $folder
  if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
  }
}

Get-ChildItem -LiteralPath $contentRoot -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne ".gitkeep" } |
  Remove-Item -Force

function Copy-MarkdownTree {
  param([string]$Name)

  $source = Join-Path $VaultRoot $Name
  $target = Join-Path $contentRoot $Name
  New-Item -ItemType Directory -Force -Path $target | Out-Null

  Get-ChildItem -LiteralPath $source -Recurse -File -Filter "*.md" |
    Where-Object {
      $_.FullName -notmatch '[\\/](?:_tools|_pdf|\.obsidian|\.claude|\.trash)[\\/]'
    } |
    ForEach-Object {
      $relative = $_.FullName.Substring($source.Length).TrimStart("\", "/")
      $destination = Join-Path $target $relative
      New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null

      $text = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
      $classVideoId = $null
      if ($Name -eq "Class Notes") {
        $videoMatch = [regex]::Match(
          $text,
          '(?m)^video:\s*https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([A-Za-z0-9_-]{11})'
        )
        if ($videoMatch.Success) {
          $classVideoId = $videoMatch.Groups[1].Value
        }
      }
      $text = $text -replace '(?m)^Printable book: \[\[[^\r\n]+\r?\n?', ''
      $text = $text -replace '\s+A[^\x00-\x7F]\s+', ' | '
      $text = $text -replace '\[\[Home\]\]', '[Home](/)'

      if ($Name -eq "Class Notes") {
        $text = $text -replace '(?m)^(?:transcript|video|source|url):\s*.*\r?\n', ''
        $text = $text -replace '(?m)^.*\[Watch on YouTube\]\([^)]+\).*\r?\n?', ''
        $text = $text -replace '(?m)^.*\[\[[^\]]+\|Full transcript\]\].*\r?\n?', ''
        $text = $text -replace '(?m)^\[\[Class Notes Index\]\]\s*\|\s*Transcript:.*$', '[[Class Notes Index]]'
        $text = $text -replace '\[([^\]]+)\]\(https?://(?:www\.)?(?:youtube\.com|youtu\.be)[^)]+\)', '$1'
        $text = $text -replace '(?m)^.*(?:Source|Original) (?:video|recording|transcript):.*\r?\n?', ''
        $text = $text -replace 'https?://(?:www\.)?(?:youtube\.com|youtu\.be)/\S+', ''
        $text = $text -replace '\s+[^\x00-\x7F]{1,3}\s+', ' | '
        if ($null -ne $classVideoId) {
          $classImageFile = "class-$($classVideoId.ToLowerInvariant()).jpg"
          $hero = @"

<figure class="class-hero">
  <img src="/static/class-images/$classImageFile" alt="Class artwork">
</figure>
"@
          $text = [regex]::Replace($text, '(?m)^(# .+)$', "`$1$hero", 1)
        }
      }

      if ($Name -eq "Class Notes") {
        [System.IO.File]::WriteAllText($destination, $text, $utf8NoBom)
      } else {
        Set-Content -LiteralPath $destination -Value $text -Encoding UTF8
      }
    }
}

Copy-MarkdownTree "Bible"
Copy-MarkdownTree "Study Bible"
Copy-MarkdownTree "Encyclopedia"
Copy-MarkdownTree "Class Notes"

$classNotesRoot = Join-Path $contentRoot "Class Notes"
$classNoteFiles = Get-ChildItem -LiteralPath $classNotesRoot -Recurse -File -Filter "*.md" |
  Where-Object { $_.Name -ne "Class Notes Index.md" }
$classNoteEntries = foreach ($note in $classNoteFiles) {
  $text = Get-Content -LiteralPath $note.FullName -Raw -Encoding UTF8
  $titleMatch = [regex]::Match($text, '(?m)^title:\s*"?(.+?)"?\s*$')
  $dateMatch = [regex]::Match($text, '(?m)^date:\s*(\d{4}-\d{2}-\d{2})\s*$')
  if ($titleMatch.Success -and $dateMatch.Success) {
    [pscustomobject]@{
      Title = $titleMatch.Groups[1].Value.Trim('"')
      Date = $dateMatch.Groups[1].Value
      Link = $note.BaseName
      Year = $dateMatch.Groups[1].Value.Substring(0, 4)
    }
  }
}

$indexLines = @(
  "---",
  "title: Class Notes",
  "---",
  "",
  "# Class Notes",
  "",
  "Verbatim notes from IUIC in the ClassRoom livestreams, with linked and embedded scripture."
)
foreach ($year in ($classNoteEntries.Year | Sort-Object -Descending -Unique)) {
  $indexLines += ""
  $indexLines += "## $year"
  $indexLines += ""
  foreach ($entry in ($classNoteEntries | Where-Object Year -eq $year | Sort-Object Date -Descending)) {
    $indexLines += "- [[$($entry.Link)|$($entry.Title)]] ($($entry.Date))"
  }
}
[System.IO.File]::WriteAllText(
  (Join-Path $classNotesRoot "Class Notes Index.md"),
  ($indexLines -join "`n"),
  $utf8NoBom
)

$homepageContent = Get-Content -LiteralPath (Join-Path $VaultRoot "Home.md") -Raw -Encoding UTF8
$homepageContent = $homepageContent -replace '(?m)^# Home\s*', ''
$homepageContent = $homepageContent -replace '(?m)^- \[\[Classroom Index\]\].*\r?\n?', ''
$homepageContent = $homepageContent -replace '(?ms)^## Production\s+.*\z', ''

$frontmatter = @"
---
title: CyberJudah Study Bible
description: A linked KJV Study Bible with Apocrypha, topical references, and verbatim class notes.
aliases:
  - Home
---

# CyberJudah Study Bible

> [!note] About this project
> An independent educational study resource built from the KJV with Apocrypha
> and verbatim class notes. This site is not affiliated with or endorsed by IUIC.

"@

$homepageContent += @"

## Copyright notice

The Bible text is the public-domain King James Version. Class notes are provided
for study, commentary, and scripture research.
"@

[System.IO.File]::WriteAllText(
  (Join-Path $contentRoot "index.md"),
  ($frontmatter + $homepageContent.Trim() + "`n"),
  $utf8NoBom
)

Write-Host "Published content refreshed from $VaultRoot"
