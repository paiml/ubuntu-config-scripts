# GitHub Actions Self-Hosted Runner Setup

This document describes how to set up and manage the GitHub Actions self-hosted runner on this VM.

## Overview

The self-hosted runner allows GitHub Actions workflows to execute on this local machine instead of GitHub-hosted runners. This is useful for:

- Access to local resources and configurations
- Custom build environments
- Cost control for heavy workloads
- Testing system-specific scripts

## Current Configuration

- **Runner Name**: `Linux-VM-Noah-MacPro-Intel`
- **Organization**: paiml
- **Agent ID**: 5283
- **Service**: `actions.runner.paiml.Linux-VM-Noah-MacPro-Intel.service`
- **Location**: `~/actions-runner`
- **Auto-start**: Enabled (starts on reboot)

## Makefile Commands

We've created convenient Makefile commands for managing the runner:

### Install Runner as Service

```bash
make runner-install
```

This command:
- Installs the GitHub Actions runner as a systemd service
- Starts the service immediately
- Configures it to auto-start on reboot

**Note**: Only run this once during initial setup.

### Start Runner

```bash
make runner-start
```

Starts the runner service if it's stopped.

### Stop Runner

```bash
make runner-stop
```

Stops the runner service.

### Check Runner Status

```bash
make runner-status
```

Displays:
- Systemd service status
- Runner process information
- Whether the runner is listening for jobs

### Restart Runner

```bash
make runner-restart
```

Performs a clean restart of the runner service.

## Manual Service Management

If you prefer to use systemd directly:

```bash
# Check status
sudo systemctl status actions.runner.paiml.Linux-VM-Noah-MacPro-Intel.service

# Start
sudo systemctl start actions.runner.paiml.Linux-VM-Noah-MacPro-Intel.service

# Stop
sudo systemctl stop actions.runner.paiml.Linux-VM-Noah-MacPro-Intel.service

# Restart
sudo systemctl restart actions.runner.paiml.Linux-VM-Noah-MacPro-Intel.service

# View logs
sudo journalctl -u actions.runner.paiml.Linux-VM-Noah-MacPro-Intel.service -f
```

## Workflow Configuration

Workflows use the following `runs-on` configuration to target this runner:

```yaml
jobs:
  my-job:
    runs-on: [self-hosted, Linux, X64]
    steps:
      - uses: actions/checkout@v4
      # ... your steps
```

Or with Gunner labels:

```yaml
jobs:
  my-job:
    runs-on: [self-hosted, Linux, X64, gunner]
    steps:
      - uses: actions/checkout@v4
      # ... your steps
```

## Verification

To verify the runner is working:

1. **Check service status**:
   ```bash
   make runner-status
   ```

2. **Trigger a test workflow**:
   ```bash
   gh workflow run "Simple Test"
   ```

3. **Watch the workflow**:
   ```bash
   gh run list --workflow="Simple Test" --limit 1
   ```

4. **Expected output**: Workflow should show `in_progress` then `completed` with `success`

## Troubleshooting

### Runner Not Picking Up Jobs

1. Check if the service is running:
   ```bash
   make runner-status
   ```

2. Check for the Runner.Listener process:
   ```bash
   pgrep -af "Runner.Listener"
   ```

3. Restart the service:
   ```bash
   make runner-restart
   ```

### View Runner Logs

```bash
sudo journalctl -u actions.runner.paiml.Linux-VM-Noah-MacPro-Intel.service -f
```

### Runner Offline After Reboot

The service should auto-start on reboot. If it doesn't:

1. Check if the service is enabled:
   ```bash
   sudo systemctl is-enabled actions.runner.paiml.Linux-VM-Noah-MacPro-Intel.service
   ```

2. Enable it if needed:
   ```bash
   sudo systemctl enable actions.runner.paiml.Linux-VM-Noah-MacPro-Intel.service
   ```

3. Start the service:
   ```bash
   make runner-start
   ```

### Reinstall Service

If you need to completely reinstall the runner service:

1. Stop and remove the service:
   ```bash
   cd ~/actions-runner
   sudo ./svc.sh stop
   sudo ./svc.sh uninstall
   ```

2. Reinstall:
   ```bash
   make runner-install
   ```

## Security Considerations

- The runner executes code from GitHub workflows with the permissions of the user `noahgift`
- Ensure workflows from untrusted sources are reviewed before execution
- The runner has access to local files and system resources
- Keep the runner software updated by periodically checking for updates

## Updates

To update the runner:

1. Stop the service:
   ```bash
   make runner-stop
   ```

2. Download the latest runner version from GitHub

3. Extract and update files in `~/actions-runner`

4. Restart the service:
   ```bash
   make runner-start
   ```

## Uninstallation

To completely remove the runner:

1. Stop and uninstall the service:
   ```bash
   cd ~/actions-runner
   sudo ./svc.sh stop
   sudo ./svc.sh uninstall
   ```

2. Remove the runner from GitHub (via organization settings or repository settings)

3. Remove the runner directory:
   ```bash
   cd ~
   ./actions-runner/config.sh remove --token <RUNNER_REMOVAL_TOKEN>
   rm -rf ~/actions-runner
   ```

## Additional Resources

- [GitHub Actions Self-Hosted Runners Documentation](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Managing Self-Hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners)
- [Self-Hosted Runner Security](https://docs.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners#self-hosted-runner-security)
