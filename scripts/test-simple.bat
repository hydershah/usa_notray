@echo off
echo Testing file existence...

echo Checking package-lock.json...
if exist "package-lock.json" (
    echo package-lock.json EXISTS
) else (
    echo package-lock.json MISSING
)

echo Checking dist\index.cjs...
if exist "dist\index.cjs" (
    echo dist\index.cjs EXISTS
) else (
    echo dist\index.cjs MISSING
)

echo Done.
