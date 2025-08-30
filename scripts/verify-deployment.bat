@echo off
echo 🔍 Verifying deployment files...

REM Check if required files exist
echo 📁 Checking required files...

set MISSING_FILES=

if exist "dist\index.cjs" (
    echo ✅ dist\index.cjs
) else (
    echo ❌ dist\index.cjs (missing)
    set MISSING_FILES=1
)

if exist "package.json" (
    echo ✅ package.json
) else (
    echo ❌ package.json (missing)
    set MISSING_FILES=1
)

if exist "package-lock.json" (
    echo ✅ package-lock.json
) else (
    echo ❌ package-lock.json (missing)
    set MISSING_FILES=1
)

if exist "ecosystem.config.js" (
    echo ✅ ecosystem.config.js
) else (
    echo ❌ ecosystem.config.js (missing)
    set MISSING_FILES=1
)

REM Check if shared directory exists
if exist "shared" (
    echo ✅ shared\ directory
) else (
    echo ❌ shared\ directory (missing)
    set MISSING_FILES=1
)

REM Check if dist directory has content
if exist "dist" (
    echo 📦 dist\ directory contents:
    dir dist
    
    REM Check if dist/index.cjs is executable
    if exist "dist\index.cjs" (
        echo ✅ dist\index.cjs exists
    ) else (
        echo ❌ dist\index.cjs not found
        set MISSING_FILES=1
    )
) else (
    echo ❌ dist\ directory not found
    set MISSING_FILES=1
)

REM Check ecosystem.config.js format
if exist "ecosystem.config.js" (
    echo 🔧 Checking ecosystem.config.js format...
    node -e "import('./ecosystem.config.js').then(config => { console.log('✅ ecosystem.config.js is valid ES module'); console.log('📱 App name:', config.default.apps[0].name); console.log('📜 Script path:', config.default.apps[0].script); }).catch(error => { console.error('❌ ecosystem.config.js error:', error.message); process.exit(1); });"
    if %errorlevel% equ 0 (
        echo ✅ ecosystem.config.js validation passed
    ) else (
        echo ❌ ecosystem.config.js validation failed
        set MISSING_FILES=1
    )
)

REM Summary
if defined MISSING_FILES (
    echo ❌ Some required files are missing or invalid
    echo 🔧 Please fix these issues before deploying
    exit /b 1
) else (
    echo 🎉 All required files are present and valid!
    echo 📦 Ready for deployment
    exit /b 0
)
