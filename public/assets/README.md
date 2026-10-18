# AgakAI artwork

- `logo-original-damaged.png`: preserved input.
- `logo-repaired.png`: new localized shoulder approximation, not recovered original pixels.
- `logo.png`, `splash_logo.png`, `icon.png`, `favicon.png`: app assets derived from the repair.
- `scripts/repair-logo.py` reproduces the shoulder repair using ffmpeg. Original lettering and pixels outside the repair rectangle are unchanged. Keep these files in Git, not `/tmp`.
