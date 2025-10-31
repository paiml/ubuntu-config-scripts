#!/bin/bash
# Launch OBS with the Screencast profile

# Launch OBS with the Screencast profile and collection
obs --profile "Screencast" --collection "Screencast" --disable-updater &

echo "OBS Studio launched with Screencast profile"
echo "Use Ctrl+Alt+R to start recording"