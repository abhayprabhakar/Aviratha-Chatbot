# PowerShell script to remove cleanup scripts themselves
Remove-Item .\__delete_test_files.ps1 -Force -ErrorAction SilentlyContinue
Remove-Item .\__delete_uploads.ps1 -Force -ErrorAction SilentlyContinue
Write-Host 'Cleanup scripts removed.'
