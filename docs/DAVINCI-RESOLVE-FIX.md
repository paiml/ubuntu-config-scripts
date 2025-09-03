# DaVinci Resolve Ubuntu 24.04 Fix Documentation

## Problem Statement

DaVinci Resolve 20.x experiences critical library incompatibility issues on Ubuntu 24.04 and derivatives, causing multi-hour downtime and preventing the application from launching.

### Symptoms

When attempting to launch DaVinci Resolve on Ubuntu 24.04, users encounter one or more of these errors:

```
/opt/resolve/bin/resolve: symbol lookup error: /usr/lib/x86_64-linux-gnu/libpango-1.0.so.0: undefined symbol: g_once_init_leave_pointer
/opt/resolve/bin/resolve: symbol lookup error: /usr/lib/x86_64-linux-gnu/libgdk_pixbuf-2.0.so.0: undefined symbol: g_task_set_static_name
/opt/resolve/bin/resolve: symbol lookup error: /usr/lib/x86_64-linux-gnu/libgio-2.0.so.0: undefined symbol: g_module_open_full
```

### Root Cause Analysis

1. **Library Version Mismatch**: DaVinci Resolve bundles outdated versions of common libraries:
   - glib 2.68 (Ubuntu 24.04 has 2.80)
   - Older versions of gio, gmodule, gobject, gdk_pixbuf

2. **Symbol Incompatibility**: The bundled libraries lack symbols that Ubuntu 24.04's system libraries expect:
   - `g_once_init_leave_pointer` (introduced in newer glib)
   - `g_task_set_static_name` (introduced in newer glib)
   - `g_module_open_full` (introduced in newer gmodule)

3. **Library Loading Order**: Linux's dynamic linker prioritizes DaVinci's bundled libraries, but these are incompatible with system libraries like pango that DaVinci doesn't bundle.

## Solution

### Quick Fix

```bash
# Apply the fix
make system-davinci-fix

# Or manually
sudo deno run --allow-all scripts/system/davinci-resolve-fix.ts
```

### What the Fix Does

The fix moves conflicting bundled libraries to a backup directory, forcing DaVinci Resolve to use Ubuntu 24.04's system libraries instead:

1. Creates backup directory: `/opt/resolve/libs/not_used/`
2. Moves conflicting libraries:
   - `libglib-2.0.so*`
   - `libgio-2.0.so*`
   - `libgmodule-2.0.so*`
   - `libgobject-2.0.so*`
   - `libgdk_pixbuf*`
3. DaVinci falls back to system libraries which are compatible

### Manual Fix Steps

If automation fails, apply manually:

```bash
cd /opt/resolve/libs
sudo mkdir not_used
sudo mv libglib-2.0.so* not_used/
sudo mv libgio* not_used/
sudo mv libgmodule* not_used/
sudo mv libgobject* not_used/
sudo mv libgdk_pixbuf* not_used/
```

## Verification

### Check if Fix is Applied

```bash
# Verify configuration
deno run --allow-all scripts/system/davinci-resolve-fix.ts --verify

# Or check manually
ls /opt/resolve/libs/not_used/
```

### Test Launch

```bash
# Launch DaVinci Resolve
davinci-resolve

# Or from terminal
/opt/resolve/bin/resolve
```

## Restoration

If you need to restore original libraries (not recommended):

```bash
# Restore via script
deno run --allow-all scripts/system/davinci-resolve-fix.ts --restore

# Or manually
sudo mv /opt/resolve/libs/not_used/* /opt/resolve/libs/
sudo rmdir /opt/resolve/libs/not_used
```

## Affected Versions

- **Affected**: DaVinci Resolve 19.x, 20.0, 20.0.1, 20.1 on Ubuntu 24.04
- **Not Affected**: DaVinci Resolve on Ubuntu 22.04 and earlier

## Prevention

### For New Installations

1. Install DaVinci Resolve normally
2. Apply the fix immediately before first launch:
   ```bash
   make system-davinci-fix
   ```

### After System Updates

Ubuntu system updates won't affect this fix since we're removing DaVinci's bundled libraries, not modifying system libraries.

### After DaVinci Updates

Reapply the fix after updating DaVinci Resolve, as updates may restore the bundled libraries:

```bash
make system-davinci-fix
```

## Troubleshooting

### Fix Doesn't Work

1. Verify DaVinci is installed:
   ```bash
   ls /opt/resolve/bin/resolve
   ```

2. Check for remaining conflicts:
   ```bash
   ldd /opt/resolve/bin/resolve | grep "not found"
   ```

3. Look for symbol errors:
   ```bash
   /opt/resolve/bin/resolve 2>&1 | grep "undefined symbol"
   ```

### Missing Libraries After Fix

If DaVinci complains about missing libraries after the fix:

```bash
# Install missing system libraries
sudo apt-get update
sudo apt-get install libglib2.0-0 libgio2.0-0 libgdk-pixbuf2.0-0
```

### Performance Issues

The fix should not impact performance. DaVinci will use system libraries which are:

- Newer and potentially more optimized
- Already loaded in memory by other applications
- Maintained by Ubuntu security updates

## Technical Details

### Why DaVinci Bundles These Libraries

- Cross-distribution compatibility
- Version consistency across Linux distributions
- Reduced dependency on system libraries

### Why This Breaks on Ubuntu 24.04

Ubuntu 24.04 upgraded to glib 2.80 which introduced new symbols. System libraries (like pango) depend on these new symbols, but DaVinci's older bundled glib doesn't provide them.

### Library Dependency Chain

```
DaVinci Resolve
├── Uses bundled: libglib-2.0.so.0 (v2.68)
├── Uses system: libpango-1.0.so.0
│   └── Expects: g_once_init_leave_pointer (from glib 2.80)
└── Conflict: Symbol not found in bundled glib
```

## References

- [Reddit: DaVinci Resolve Symbol Error](https://www.reddit.com/r/davinciresolve/comments/1d7cr2w/)
- [GitHub Gist: DaVinci Resolve 19 Linux Fix](https://gist.github.com/davidsmfreire/2243433bed0d9d9e352da3508b51e63d)
- [Blackmagic Forum: Linux Installation Issues](https://forum.blackmagicdesign.com/viewtopic.php?f=38&t=200276)
- [Ubuntu 24.04 glib Changelog](https://launchpad.net/ubuntu/+source/glib2.0)

## Support

For issues with this fix:

1. Run verification: `make system-davinci-fix --verify`
2. Check logs: `~/.local/share/DaVinciResolve/logs/`
3. Report issues: https://github.com/anthropics/ubuntu-config-scripts/issues

## Credits

This fix is based on community solutions from Reddit, various Linux forums, and extensive testing. Special thanks to the Linux video editing community for identifying and documenting this solution.
