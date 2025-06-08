# PowerShell script to clean up all test/dev/demo/debug files for production
$patterns = @(
    'test_*', '*test*', '*debug*', '*demo*', '*simple*', '*integration*', '*comprehensive*', '*quick*', '*direct*', '*rag-*', '*upload-and-test*', '*final*', '*check-db*', '*status*', '*import*', '*MIGRATION_COMPLETE*', '*RAG_SUCCESS_REPORT*', '*DEPLOYMENT*', '*-old*', '*-backup*', '*-new*', '*dev.db', '*requirements.txt', '*README.md', '*integration-test.txt', '*__pycache__', '*test-export.ts'
)
foreach ($pattern in $patterns) {
    Get-ChildItem -Path . -Include $pattern -Recurse -Force | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
}
Write-Host 'All test/dev/demo/debug files have been removed.'
