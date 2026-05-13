# How to Configure Verified Commits in GitHub

This guide walks you through setting up verified (signed) commits in GitHub using SSH keys. Verified commits display a "Verified" badge, confirming that commits come from a trusted source.

SSH signing is the recommended approach as it reuses your existing SSH keys and is simpler to configure than traditional GPG signing.

## Prerequisites

- Git installed on your machine
- A GitHub account
- Terminal/command line access

---

## Setup Steps

### Step 1: Check for Existing SSH Keys

```bash
ls -la ~/.ssh
```

Look for files like `id_ed25519.pub`, `id_rsa.pub`, or `id_ecdsa.pub`. If you have one, skip to Step 3.

### Step 2: Generate a New SSH Key (if needed)

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Press Enter to accept the default file location. Set a passphrase when prompted (recommended).

### Step 3: Add SSH Key to GitHub

1. Copy your public key:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

2. Go to GitHub → Settings → SSH and GPG keys → New SSH key
3. Set "Key type" to **Signing Key** (important!)
4. Paste your public key and save

### Step 4: Configure Git to Use SSH Signing

```bash
# Tell Git to use SSH for signing
git config --global gpg.format ssh

# Specify your SSH signing key
git config --global user.signingkey ~/.ssh/id_ed25519.pub

# Sign all commits by default (optional but recommended)
git config --global commit.gpgsign true
```

### Step 5: Test Your Configuration

Create a test commit:

```bash
git commit --allow-empty -m "Test signed commit"
```

Check if it's signed:

```bash
git log --show-signature -1
```

You should see signature information in the output.

### Step 6: Push and Verify on GitHub

```bash
git push
```

Visit your repository on GitHub and check the commit. It should display a "Verified" badge.

---

## Troubleshooting

### Commits Show as Unverified on GitHub

1. **Email mismatch:** Ensure your Git email matches your GitHub email:
   ```bash
   git config --global user.email "your_github_email@example.com"
   ```

2. **Key not added to GitHub:** Verify your key is listed in GitHub Settings → SSH and GPG keys

3. **Wrong key type on GitHub:** For SSH signing, ensure the key is added as a "Signing Key", not just an authentication key

### SSH Signing Not Working

Ensure you added the public key (`.pub` file) to GitHub as a **Signing Key**, not a regular SSH key.

---

## Signing Individual Commits (Without Auto-Signing)

If you didn't enable `commit.gpgsign true`, you can sign commits manually:

```bash
git commit -S -m "Your commit message"
```

The `-S` flag signs the commit.

---

## Additional Resources

- [GitHub Docs: About commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
- [GitHub Docs: Signing commits with SSH](https://docs.github.com/en/authentication/managing-commit-signature-verification/telling-git-about-your-signing-key#telling-git-about-your-ssh-key)
