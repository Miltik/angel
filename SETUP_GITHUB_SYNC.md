# GitHub Sync Setup Guide

This guide will help you configure ANGEL to sync automatically from your GitHub repository.

## Step 1: Push to GitHub

1. **Initialize Git** (if not already done):
   ```powershell
   cd "c:\Users\cpawl\Documents\VSCode\angel"
   git init
   ```

2. **Create a GitHub repository**:
   - Go to GitHub.com
   - Click "New Repository"
   - Name it (e.g., "bitburner-angel" or "angel")
   - Make it **public** (required for wget without authentication)
   - Don't initialize with README (you already have files)

3. **Push your code**:
   ```powershell
   git add .
   git commit -m "Initial commit: ANGEL orchestrator for Bitburner"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

## Step 2: Configure sync.js

1. **Open** [sync.js](sync.js)

2. **Update these variables** at the top:
   ```javascript
   const GITHUB_USER = "YOUR_GITHUB_USERNAME";    // Your GitHub username
   const GITHUB_REPO = "YOUR_REPO_NAME";          // Your repository name
   const GITHUB_BRANCH = "main";                   // Usually "main" or "master"
   const REPO_SUBDIR = "";                         // Leave empty if files are in root
   ```

3. **Example**:
   ```javascript
   const GITHUB_USER = "cpawl";
   const GITHUB_REPO = "bitburner-angel";
   const GITHUB_BRANCH = "main";
   const REPO_SUBDIR = "";  // Files are in root of repo
   ```

4. **Save and commit**:
   ```powershell
   git add sync.js
   git commit -m "Configure sync.js with repository details"
   git push
   ```

## Step 3: Option A - Direct Download (Quick)

In Bitburner terminal:

```javascript
// Replace with your actual URL
wget https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/sync.js /angel/sync.js

// Run the sync
run /angel/sync.js
```

## Step 3: Option B - Bootstrap Method (Easier for sharing)

1. **Configure bootstrap.js**:
   - Open [bootstrap.js](bootstrap.js)
   - Update the `SYNC_SCRIPT_URL` with your GitHub URL:
     ```javascript
     const SYNC_SCRIPT_URL = "https://raw.githubusercontent.com/cpawl/bitburner-angel/main/sync.js";
     ```

2. **Commit the change**:
   ```powershell
   git add bootstrap.js
   git commit -m "Configure bootstrap script"
   git push
   ```

3. **In Bitburner**, just copy the bootstrap script content and save it, then:
   ```javascript
   run bootstrap.js
   run /angel/sync.js
   ```

## Step 4: Updating ANGEL

Whenever you make changes to ANGEL:

1. **Commit and push** to GitHub:
   ```powershell
   git add .
   git commit -m "Update ANGEL features"
   git push
   ```

2. **In Bitburner**, just run:
   ```javascript
   run /angel/sync.js
   ```

All files will be updated automatically!

## URL Format Reference

GitHub raw URLs follow this format:
```
https://raw.githubusercontent.com/USERNAME/REPO/BRANCH/PATH_TO_FILE
```

**Example**:
```
https://raw.githubusercontent.com/cpawl/bitburner-angel/main/sync.js
https://raw.githubusercontent.com/cpawl/bitburner-angel/main/angel.js
https://raw.githubusercontent.com/cpawl/bitburner-angel/main/modules/hacking.js
```

## Troubleshooting

### "Failed to download" errors

**Check:**
1. Repository is **public** (private repos require authentication)
2. File paths are correct
3. Branch name is correct ("main" vs "master")
4. URL doesn't have typos

**Test your URL**:
- Copy the raw URL and paste it in a browser
- If it downloads/shows the file, it's correct
- If you get a 404, check the path

### Some files succeed, others fail

**Fix:**
- Check that ALL files exist in your GitHub repo
- Look at the failed file names - they might not be committed
- Run `git status` locally to see unstaged files

### Changes not reflecting in Bitburner

**Fix:**
1. Make sure you pushed to GitHub: `git push`
2. Wait a few seconds for GitHub to update
3. Run sync.js again in Bitburner

## Private Repository Option

If you want to use a private repository:

1. **Create a GitHub Personal Access Token**:
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate new token with `repo` scope
   - Copy the token

2. **Modify the wget URL** in Bitburner:
   ```javascript
   // This is more complex and not recommended for beginners
   // Better to use a public repo or manual copying
   ```

3. **Alternative**: Use manual file copying for private repositories

## Best Practices

✓ **Use descriptive commit messages**
✓ **Test changes locally** before pushing
✓ **Keep sync.js configured** with your repo details
✓ **Commit often** to track changes
✓ **Use branches** for experimental features

## Quick Reference

| Action | Command |
|--------|---------|
| First sync setup | `wget <your-url>/sync.js /angel/sync.js` |
| Update from GitHub | `run /angel/sync.js` |
| Check what needs committing | `git status` |
| Commit changes | `git add . && git commit -m "message"` |
| Push to GitHub | `git push` |
| Check sync status | `run /angel/install.js` |

---

**Need help?** Check the [README](README.md) or [QUICKSTART](QUICKSTART.md) guides.
