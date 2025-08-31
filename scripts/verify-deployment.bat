@echo off
echo 🔍 Verifying deployment files...

REM Check if required files exist
echo 📁 Checking required files...

set MISSING_FILES=

dir "dist\index.cjs" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ dist\index.cjs
) else (
    echo ❌ dist\index.cjs (missing)
    set MISSING_FILES=1
)
echo 🔍 Debug: After first dist\index.cjs check, MISSING_FILES=%MISSING_FILES%

dir "package.json" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ package.json
) else (
    echo ❌ package.json (missing)
    set MISSING_FILES=1
)
echo 🔍 Debug: After package.json check, MISSING_FILES=%MISSING_FILES%

dir "package-lock.json" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ package-lock.json
) else (
    echo ❌ package-lock.json (missing)
    set MISSING_FILES=1
)
echo 🔍 Debug: After package-lock.json check, MISSING_FILES=%MISSING_FILES%

dir "ecosystem.config.cjs" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ ecosystem.config.cjs
) else (
    echo ❌ ecosystem.config.cjs (missing)
    set MISSING_FILES=1
)

REM Check if shared directory exists
dir "shared" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ shared\ directory
) else (
    echo ❌ shared\ directory (missing)
    set MISSING_FILES=1
)

REM Check if dist directory has content
dir "dist" >nul 2>&1
if %errorlevel% equ 0 (
    echo 📦 dist\ directory contents:
    dir dist
    
    REM Check if dist/index.cjs is executable
    dir "dist\index.cjs" >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ dist\index.cjs exists
    ) else (
        echo ❌ dist\index.cjs not found
        set MISSING_FILES=1
    )
) else (
    echo ❌ dist\ directory not found
    set MISSING_FILES=1
)

REM Check ecosystem.config.cjs format
dir "ecosystem.config.cjs" >nul 2>&1
if %errorlevel% equ 0 (
    echo 🔧 Checking ecosystem.config.cjs format...
    node -e "try { const config = require('./ecosystem.config.cjs'); console.log('✅ ecosystem.config.cjs is valid CommonJS module'); console.log('📱 App name:', config.apps[0].name); console.log('📜 Script path:', config.apps[0].script); } catch (error) { console.error('❌ ecosystem.config.cjs error:', error.message); process.exit(1); }"
    if %errorlevel% equ 0 (
        echo ✅ ecosystem.config.cjs validation passed
    ) else (
        echo ❌ ecosystem.config.cjs validation failed
        set MISSING_FILES=1
    )
)

REM Summary
echo 🔍 Debug: MISSING_FILES variable is: %MISSING_FILES%
if defined MISSING_FILES (
    echo ❌ Some required files are missing or invalid
    echo 🔧 Please fix these issues before deploying
    exit /b 1
) else (
    echo 🎉 All required files are present and valid!
    echo 📦 Ready for deployment
    exit /b 0
)
