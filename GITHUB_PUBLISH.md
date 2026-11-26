# Publishing To GitHub

These steps publish the current project to your personal GitHub account.

## 1. Final Check

Make sure generated files, media, transcripts, and secrets are not included:

```bash
git status --short
```

If the project is not a Git repository yet, continue with the next step.

## 2. Initialize The Repository

```bash
git init
git add .
git status --short
```

Before committing, confirm the staged files do not include:

- `work/`
- `outputs/`
- `.env`
- Cookie files
- SSH private keys
- Downloaded videos, audio files, transcripts, or exported clips

## 3. First Commit

```bash
git commit -m "Initial release"
```

## 4. Create A GitHub Repository

Create an empty GitHub repository, for example:

```text
video-audio-transcript-tool
```

Do not enable automatic README, LICENSE, or `.gitignore` creation because this project already includes those files.

## 5. Push

Replace the URL below with your GitHub username and repository name:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/video-audio-transcript-tool.git
git push -u origin main
```

## 6. Pre-Release Reminder

This project includes download and transcoding features. Keep the README disclaimer visible, and remind users to process only content they have the right to access and process.
