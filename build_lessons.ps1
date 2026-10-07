$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$resourceRoot = Join-Path $root "ressources"
$outputPath = Join-Path $root "lessons-data.js"
$lessons = [System.Collections.Generic.List[object]]::new()
$topicPattern = '^[^\p{L}\p{N}]+(?<title>.+)$'
$eAcute = [char]0x00E9
$eGrave = [char]0x00E8
$aGrave = [char]0x00E0
$lessonTitles = @{
    1 = "Les bases"
    2 = "Le tap, le touch et le rollball"
    3 = "La passe et les positions en jeu"
    4 = "Le recul d" + $eAcute + "fensif et le demi de jeu"
    5 = "La touche, la passe et le point de remise en jeu"
    6 = "Gagner du terrain et avancer " + $aGrave + " deux"
    7 = "Avancer " + $aGrave + " trois et la combinaison rapide"
    8 = "Le 32 Peel (Bus) et le soutien arri" + $eGrave + "re"
    9 = "La d" + $eAcute + "fense miroir et la d" + $eAcute + "fense ferm" + $eAcute + "e"
    10 = "Ratios en mixte et exclusions temporaires"
}
$lessonCategories = @{
    1 = "R" + [char]0x00E8 + "gles"
    2 = "R" + [char]0x00E8 + "gles"
    3 = "R" + [char]0x00E8 + "gles"
    4 = "R" + [char]0x00E8 + "gles"
    5 = "R" + [char]0x00E8 + "gles"
    6 = "Attaque"
    7 = "Attaque"
    8 = "Attaque"
    9 = "D" + [char]0x00E9 + "fense"
    10 = "R" + [char]0x00E8 + "gles"
}

if (-not (Test-Path -LiteralPath $resourceRoot -PathType Container)) {
    throw "Dossier de ressources introuvable : $resourceRoot"
}

$folders = @(Get-ChildItem -LiteralPath $resourceRoot -Directory | Where-Object { $_.Name -match '^Lesson(\d+)$' })

foreach ($folder in $folders) {
    $number = [int]([regex]::Match($folder.Name, '^Lesson(\d+)$').Groups[1].Value)
    $textFiles = @(Get-ChildItem -LiteralPath $folder.FullName -File -Filter "*.txt" | Sort-Object Name)
    if ($textFiles.Count -eq 0) {
        throw "No .txt caption found in $($folder.Name)"
    }

    $caption = [System.IO.File]::ReadAllText($textFiles[0].FullName).Trim()
    $captionLines = [System.Collections.Generic.List[string]]::new()
    $hashtags = [System.Collections.Generic.List[string]]::new()
    foreach ($line in ($caption -split '\r?\n')) {
        $trimmed = $line.Trim()
        if (-not $trimmed) {
            continue
        }
        if ($trimmed -match '^\s*(?:#[\w-]+\s*)+$') {
            foreach ($tag in [regex]::Matches($trimmed, '#[\w-]+')) {
                if (-not $hashtags.Contains($tag.Value)) {
                    $hashtags.Add($tag.Value)
                }
            }
        }
        else {
            $captionLines.Add($trimmed)
        }
    }

    $dateMatch = [regex]::Match($textFiles[0].BaseName, '\d{4}-\d{2}-\d{2}')
    $publishedAt = ""
    if ($dateMatch.Success) {
        $publishedAt = $dateMatch.Value
        [void][datetime]::ParseExact($publishedAt, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
    }

    $images = @{}
    $videos = @{}
    foreach ($file in (Get-ChildItem -LiteralPath $folder.FullName -File)) {
        $mediaMatch = [regex]::Match($file.Name, '_(\d+)\.(jpg|mp4)$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        if (-not $mediaMatch.Success) {
            continue
        }
        $index = [int]$mediaMatch.Groups[1].Value
        $relativePath = $file.FullName.Substring($root.Length).TrimStart([char[]]@('\', '/')).Replace('\', '/')
        if ($mediaMatch.Groups[2].Value -ieq "jpg") {
            $images[$index] = $relativePath
        }
        else {
            $videos[$index] = $relativePath
        }
    }

    $media = [System.Collections.Generic.List[object]]::new()
    $mediaIndexes = @($images.Keys) + @($videos.Keys) | Sort-Object -Unique
    foreach ($index in $mediaIndexes) {
        $image = $images[$index]
        $video = $videos[$index]
        if ($video) {
            $item = [ordered]@{ type = "video"; src = $video }
            if ($image) {
                $item.poster = $image
            }
            $media.Add($item)
        }
        elseif ($image) {
            $media.Add([ordered]@{ type = "image"; src = $image })
        }
    }

    $title = ""
    if ($captionLines.Count -gt 0) {
        $headingParts = [regex]::Split($captionLines[0], '\s+[\u2013\u2014-]\s+', 2)
        if ($headingParts.Count -gt 1) {
            $candidate = $headingParts[1].Trim() -replace '[^\p{L}\p{N}]+$', ''
            $numberedTitle = [regex]::Match($candidate, '^(?:LESSON|WEEK|LE[C\u00C7]ON|SEMAINE)\s+(?:\w+|\d+)\s*:\s*(?<title>.+)$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
            if ($numberedTitle.Success) {
                $title = $numberedTitle.Groups["title"].Value.Trim() -replace '[^\p{L}\p{N}]+$', ''
            }
            elseif ($candidate -notmatch '^(?:(?:LESSON|WEEK)\s+(?:\w+|\d+)(?:\s+IS\s+HERE)?|(?:VOICI\s+)?(?:LA\s+)?LE[C\u00C7]ON\s+(?:\w+|\d+))[!:]?\s*$') {
                $title = $candidate -replace '[^\p{L}\p{N}]+$', ''
            }
        }
    }
    if (-not $title) {
        foreach ($line in ($captionLines | Select-Object -Skip 1)) {
            $topicMatch = [regex]::Match($line, $topicPattern)
            if ($topicMatch.Success) {
                $topic = ([regex]::Split($topicMatch.Groups["title"].Value, '\s+[\u2013\u2014-]\s+', 2)[0] -replace '\s*[\(\[].*$', '').Trim()
                if ($topic.Length -le 70) {
                    $title = $topic -replace '[^\p{L}\p{N}]+$', ''
                    break
                }
            }
        }
    }
    if (-not $title) {
        $title = "Lesson $number"
    }
    if ($lessonTitles.ContainsKey($number)) {
        $title = $lessonTitles[$number]
    }

    $content = $captionLines -join "`n"
    $category = "Attaque"
    if ($lessonCategories.ContainsKey($number)) {
        $category = $lessonCategories[$number]
    }
    elseif ($title -match '\b(defen[cs]e?|mirror|corner|shut defence|d\u00e9fense)\b') {
        $category = "D" + [char]0x00E9 + "fense"
    }
    elseif ($title -match '\b(rule|offside|onside|tap|roll[\s-]?ball|drop[\s-]?off|basics|field|players?|positions?)\b') {
        $category = "R" + [char]0x00E8 + "gles"
    }

    $lessons.Add([ordered]@{
        number = $number
        title = $title
        caption = $content
        hashtags = @($hashtags.ToArray())
        category = $category
        publishedAt = $publishedAt
        media = @($media.ToArray())
    })
}

if ($lessons.Count -eq 0) {
    throw "No LessonN folders found in $resourceRoot"
}

$sortedLessons = @($lessons | Sort-Object number)
$json = ConvertTo-Json -InputObject $sortedLessons -Depth 8 -Compress
$json = $json.Replace("<", "\u003c").Replace([string][char]0x2028, "\u2028").Replace([string][char]0x2029, "\u2029")
$encoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
[System.IO.File]::WriteAllText($outputPath, "window.LESSONS = $json;`n", $encoding)
Write-Output "Built $($lessons.Count) lessons in lessons-data.js."
