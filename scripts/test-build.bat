@echo off
echo 🧪 Testing build process...

REM Clean previous builds
echo 🧹 Cleaning previous builds...
call npm run build:clean

REM Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm ci
)

REM Build the application
echo 🔨 Building application...
call npm run build:production

REM Verify build output
echo ✅ Verifying build output...
if exist "dist\index.cjs" (
    echo ✅ dist\index.cjs found successfully
    echo 📁 Build contents:
    dir dist
    
    REM Test if the built file can be executed
    echo 🧪 Testing built file...
    node -c dist\index.cjs
    if %errorlevel% equ 0 (
        echo ✅ Built file syntax is valid
    ) else (
        echo ❌ Built file has syntax errors
        exit /b 1
    )
) else (
    echo ❌ dist\index.cjs not found
    echo 📁 Current directory contents:
    dir
    echo 📁 dist\ directory contents (if exists):
    if exist "dist" dir dist
    exit /b 1
)

echo 🎉 Build test completed successfully!
