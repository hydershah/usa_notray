#!/bin/bash

# Add Node.js 20 to PATH
export PATH="/usr/local/opt/node@20/bin:$PATH"

# Start the development server
echo "Starting NotaryPro development server..."
echo "Access the app at: http://localhost:3000"
echo ""
echo "Login credentials:"
echo "Email: admin@usanotary.com"
echo "Password: (use your configured password)"
echo ""

npm run dev 