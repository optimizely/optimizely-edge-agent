@echo off
echo Renaming all .md files to .mdc in .cursor\rules directory...

:: First, let's handle the problematic file
if exist ".cursor\rules\decision-trees\%.mdc" (
  echo Fixing the problematic file...
  ren ".cursor\rules\decision-trees\%.mdc" "decision-tree-context-management-domain.mdc"
)

:: Now rename any remaining .md files
for /r ".cursor\rules" %%i in (*.md) do (
  echo Renaming %%i to %%~ni.mdc
  ren "%%i" "%%~ni.mdc"
)

:: Check if all files are renamed correctly
echo Verifying files...
dir /b ".cursor\rules\*.md" 2>nul
dir /b ".cursor\rules\decision-trees\*.md" 2>nul

echo Done! 