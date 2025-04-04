const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}==============================================${colors.reset}`);
console.log(`${colors.blue}Spotify Karaoke - Environment Check${colors.reset}`);
console.log(`${colors.blue}==============================================${colors.reset}`);

// Check if node_modules exists
console.log('\nChecking node_modules directory:');
if (fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log(`${colors.green}✅ node_modules directory exists${colors.reset}`);
} else {
  console.log(`${colors.red}❌ node_modules directory is missing. Run 'npm install' first.${colors.reset}`);
}

// Check if the public directory exists
console.log('\nChecking public directory:');
if (fs.existsSync(path.join(__dirname, 'public'))) {
  console.log(`${colors.green}✅ public directory exists${colors.reset}`);
  
  // Check if public/index.html exists
  if (fs.existsSync(path.join(__dirname, 'public', 'index.html'))) {
    console.log(`${colors.green}✅ public/index.html exists${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ public/index.html is missing${colors.reset}`);
  }
} else {
  console.log(`${colors.red}❌ public directory is missing${colors.reset}`);
}

// Check if the src directory exists
console.log('\nChecking src directory:');
if (fs.existsSync(path.join(__dirname, 'src'))) {
  console.log(`${colors.green}✅ src directory exists${colors.reset}`);
  
  // Check if src/index.tsx exists
  if (fs.existsSync(path.join(__dirname, 'src', 'index.tsx'))) {
    console.log(`${colors.green}✅ src/index.tsx exists${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ src/index.tsx is missing${colors.reset}`);
  }
  
  // Check if src/App.tsx exists
  if (fs.existsSync(path.join(__dirname, 'src', 'App.tsx'))) {
    console.log(`${colors.green}✅ src/App.tsx exists${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ src/App.tsx is missing${colors.reset}`);
  }
} else {
  console.log(`${colors.red}❌ src directory is missing${colors.reset}`);
}

// Check for server directories
console.log('\nChecking server directory:');
if (fs.existsSync(path.join(__dirname, 'server'))) {
  console.log(`${colors.green}✅ server directory exists${colors.reset}`);
  
  // Check if server/server.js exists
  if (fs.existsSync(path.join(__dirname, 'server', 'server.js'))) {
    console.log(`${colors.green}✅ server/server.js exists${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ server/server.js is missing${colors.reset}`);
  }
  
  // Check if server/redirect-server.js exists
  if (fs.existsSync(path.join(__dirname, 'server', 'redirect-server.js'))) {
    console.log(`${colors.green}✅ server/redirect-server.js exists${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ server/redirect-server.js is missing${colors.reset}`);
  }
} else {
  console.log(`${colors.red}❌ server directory is missing${colors.reset}`);
}

// Check for environment file
console.log('\nChecking environment files:');
if (fs.existsSync(path.join(__dirname, '.env'))) {
  console.log(`${colors.green}✅ .env file exists${colors.reset}`);
  
  // Read .env file to check essential variables
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  
  if (envContent.includes('REACT_APP_SPOTIFY_CLIENT_ID')) {
    console.log(`${colors.green}✅ REACT_APP_SPOTIFY_CLIENT_ID is defined${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ REACT_APP_SPOTIFY_CLIENT_ID is missing${colors.reset}`);
  }
  
  if (envContent.includes('REACT_APP_REDIRECT_URI')) {
    console.log(`${colors.green}✅ REACT_APP_REDIRECT_URI is defined${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ REACT_APP_REDIRECT_URI is missing${colors.reset}`);
  }
} else {
  console.log(`${colors.red}❌ .env file is missing${colors.reset}`);
}

// Provide next steps
console.log('\n');
console.log(`${colors.blue}==============================================${colors.reset}`);
console.log(`${colors.blue}Next Steps${colors.reset}`);
console.log(`${colors.blue}==============================================${colors.reset}`);
console.log(`
1. Run the following commands:
   ${colors.yellow}npm install${colors.reset}
   ${colors.yellow}cd server && npm install && cd ..${colors.reset}

2. Start all services:
   ${colors.yellow}npm run start-all${colors.reset}

3. If you're still seeing a black screen, check your browser console for errors.
`);

console.log(`${colors.blue}==============================================${colors.reset}`);
console.log(`${colors.blue}Troubleshooting${colors.reset}`);
console.log(`${colors.blue}==============================================${colors.reset}`);
console.log(`
If you're still having issues:
1. Try running each server separately:
   ${colors.yellow}# Terminal 1: Frontend${colors.reset}
   ${colors.yellow}npm start${colors.reset}

   ${colors.yellow}# Terminal 2: Redirect Server${colors.reset}
   ${colors.yellow}cd server && node redirect-server.js${colors.reset}

   ${colors.yellow}# Terminal 3: API Server${colors.reset}
   ${colors.yellow}cd server && node server.js${colors.reset}

2. Check if the port 3000 is already in use:
   ${colors.yellow}npx kill-port 3000${colors.reset}

3. Clear your browser cache and try again.
`);

console.log(`${colors.blue}==============================================${colors.reset}`);