param(
    [string]$MongoUri = "mongodb://localhost:27017",
    [string]$DbName = "only-facts",
    [string]$CsvPath = "data/raw/twitter-posts.csv",
    [string]$SourceCollection = "raw_social_posts",
    [string]$TargetCollection = "test_posts",
    [string]$DateField = "publish_date",
    [string]$AccountField = "author",
    [string]$ContentField = "content",
    [string]$ReferenceField = "",
    [string]$ExternalAuthorIdField = "external_author_id",
    [string]$RegionField = "region",
    [string]$LanguageField = "language",
    [string]$PostTypeField = "post_type",
    [string]$RetweetField = "retweet",
    [string]$FollowersField = "followers",
    [string]$FollowingField = "following",
    [string]$UpdatesField = "updates",
    [string]$AccountTypeField = "account_type",
    [string]$AccountCategoryField = "account_category",
    [string]$HarvestedDateField = "harvested_date"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-CommandExists {
    param([string]$CommandName)
    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $CommandName"
    }
}

Assert-CommandExists -CommandName "mongoimport"
Assert-CommandExists -CommandName "mongosh"

if (-not (Test-Path -Path $CsvPath)) {
    throw "CSV file not found at path: $CsvPath"
}

Write-Host "Importing CSV into staging collection..."
$importArgs = @(
    "--uri", "$MongoUri/$DbName",
    "--collection", $SourceCollection,
    "--type", "csv",
    "--headerline",
    "--drop",
    "--file", $CsvPath
)

& mongoimport @importArgs
if ($LASTEXITCODE -ne 0) {
    throw "mongoimport failed with exit code $LASTEXITCODE"
}

$normalizeScriptPath = Join-Path $PSScriptRoot "mongo\normalize-test-posts.js"
if (-not (Test-Path -Path $normalizeScriptPath)) {
    throw "Normalization script missing: $normalizeScriptPath"
}

Write-Host "Normalizing staging records into clustering-ready schema..."
$mongoshArgs = @(
    "--quiet",
    "$MongoUri/$DbName",
    $normalizeScriptPath,
    "--",
    $SourceCollection,
    $TargetCollection,
    $DateField,
    $AccountField,
    $ContentField,
    $ReferenceField,
    $ExternalAuthorIdField,
    $RegionField,
    $LanguageField,
    $PostTypeField,
    $RetweetField,
    $FollowersField,
    $FollowingField,
    $UpdatesField,
    $AccountTypeField,
    $AccountCategoryField,
    $HarvestedDateField
)

& mongosh @mongoshArgs
if ($LASTEXITCODE -ne 0) {
    throw "mongosh normalization failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Dataset import complete."
Write-Host "Database: $DbName"
Write-Host "Staging collection: $SourceCollection"
Write-Host "Target collection: $TargetCollection"
