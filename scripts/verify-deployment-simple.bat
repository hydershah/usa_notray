@echo off
echo 🔍 Verifying deployment files...

echo 📁 Checking required files...

REM Check each file individually
echo Checking dist\index.cjs...
if exist "dist\index.cjs" (
    echo ✅ dist\index.cjs - FOUND
) else (
    echo ❌ dist\index.cjs - MISSING
    goto :error
)

echo Checking package.json...
if exist "package.json" (
    echo ✅ package.json - FOUND
) else (
    echo ❌ package.json - MISSING
    goto :error
)

echo Checking package-lock.json...
if exist "package-lock.json" (
    echo ✅ package-lock.json - FOUND
) else (
    echo ❌ package-lock.json - MISSING
    goto :error
)

echo Checking ecosystem.config.cjs...
if exist "ecosystem.config.cjs" (
    echo ✅ ecosystem.config.cjs - FOUND
) else (
    echo ❌ ecosystem.config.cjs - MISSING
    goto :error
)

echo Checking shared directory...
if exist "shared" (
    echo ✅ shared\ directory - FOUND
) else (
    echo ❌ shared\ directory - MISSING
    goto :error
)

echo.
echo 🔧 Validating ecosystem.config.cjs...
node -e "try { const config = require('./ecosystem.config.cjs'); console.log('✅ ecosystem.config.cjs is valid'); console.log('📱 App name:', config.apps[0].name); console.log('📜 Script path:', config.apps[0].script); } catch (error) { console.error('❌ Validation failed:', error.message); process.exit(1); }"
if %errorlevel% neq 0 (
    echo ❌ ecosystem.config.cjs validation failed
    goto :error
)

echo.
echo 🎉 All required files are present and valid!
echo 📦 Ready for deployment
exit /b 0

:error
echo.
echo ❌ Some required files are missing or invalid
echo 🔧 Please fix these issues before deploying
exit /b 1
