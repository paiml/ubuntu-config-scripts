#!/bin/bash
# Apply aggressive pango fix
echo "Applying aggressive pango fix..."
echo "This will temporarily move system pango libraries"
echo "You may need to enter your sudo password"

sudo /home/noah/.local/bin/deno run --allow-all scripts/system/fix-davinci-20-pango.ts --aggressive

echo ""
echo "Fix applied. Now try launching DaVinci Resolve with:"
echo "  davinci-resolve-fixed"
echo ""
echo "To restore pango libraries later (if needed for other apps):"
echo "  sudo /home/noah/.local/bin/deno run --allow-all scripts/system/fix-davinci-20-pango.ts --restore"