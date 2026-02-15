# Sync Script Example Configuration

After you push your code to GitHub, update [sync.js](sync.js) with these values:

## Example Configuration

If your GitHub repository is at:
```
https://github.com/cpawl/bitburner-angel
```

Then edit the configuration section in [sync.js](sync.js):

```javascript
// ========================================
// CONFIGURATION - UPDATE THESE VALUES
// ========================================

const GITHUB_USER = "cpawl";                       // Your GitHub username
const GITHUB_REPO = "bitburner-angel";             // Your repository name
const GITHUB_BRANCH = "main";                      // Branch (usually "main")

// Optional: If files are in a subdirectory, specify it here
const REPO_SUBDIR = "";                            // Leave empty if in root
```

## For Bootstrap Script

If your sync.js is at:
```
https://github.com/cpawl/bitburner-angel/blob/main/sync.js
```

Then the **raw URL** is:
```
https://raw.githubusercontent.com/cpawl/bitburner-angel/main/sync.js
```

Update [bootstrap.js](bootstrap.js):

```javascript
const SYNC_SCRIPT_URL = "https://raw.githubusercontent.com/cpawl/bitburner-angel/main/sync.js";
```

## Common Scenarios

### Scenario 1: Files in repository root
```
Repository: github.com/yourusername/bitburner-scripts
File structure:
  /angel.js
  /config.js
  /modules/hacking.js
  etc.

Configuration:
  GITHUB_USER = "yourusername"
  GITHUB_REPO = "bitburner-scripts"
  REPO_SUBDIR = ""
```

### Scenario 2: Files in a subdirectory
```
Repository: github.com/yourusername/bitburner-all
File structure:
  /angel/angel.js
  /angel/config.js
  /angel/modules/hacking.js
  etc.

Configuration:
  GITHUB_USER = "yourusername"
  GITHUB_REPO = "bitburner-all"
  REPO_SUBDIR = "angel"
```

### Scenario 3: Using develop branch
```
Repository: github.com/yourusername/angel
Branch: develop (instead of main)

Configuration:
  GITHUB_USER = "yourusername"
  GITHUB_REPO = "angel"
  GITHUB_BRANCH = "develop"
  REPO_SUBDIR = ""
```

## Testing Your Configuration

1. **Build your expected URL**:
   ```
   https://raw.githubusercontent.com/[USER]/[REPO]/[BRANCH]/[SUBDIR]/angel.js
   ```

2. **Test in browser**:
   - Copy the URL
   - Paste in browser address bar
   - If you see the file content, configuration is correct!
   - If you get 404, check the path

3. **Example test URLs**:
   ```
   # Test the main file
   https://raw.githubusercontent.com/cpawl/bitburner-angel/main/angel.js
   
   # Test a module
   https://raw.githubusercontent.com/cpawl/bitburner-angel/main/modules/hacking.js
   
   # If in subdirectory
   https://raw.githubusercontent.com/cpawl/bitburner-all/main/angel/angel.js
   ```

## Quick Checklist

Before running sync in Bitburner:

- [ ] Code is pushed to GitHub
- [ ] Repository is public
- [ ] Tested raw URLs in browser
- [ ] Updated `GITHUB_USER` in sync.js
- [ ] Updated `GITHUB_REPO` in sync.js
- [ ] Updated `GITHUB_BRANCH` if needed
- [ ] Updated `REPO_SUBDIR` if files are in a folder
- [ ] Committed and pushed the configured sync.js

## In Bitburner

Once configured, in the Bitburner terminal:

```javascript
// First time: Download sync.js
wget https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/sync.js /angel/sync.js

// Run sync to get all files
run /angel/sync.js

// Future updates: Just run sync
run /angel/sync.js
```

## Still Need Help?

See the full guide: [SETUP_GITHUB_SYNC.md](SETUP_GITHUB_SYNC.md)
