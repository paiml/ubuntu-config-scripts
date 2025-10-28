#!/bin/bash

# Set timezone to Madrid
echo "Setting timezone to Madrid (Europe/Madrid)..."
sudo timedatectl set-timezone Europe/Madrid

# Configure for 12-hour format (this is usually a locale/display setting)
echo "Configuring locale for 12-hour time format..."

# Create or update locale environment
sudo tee /etc/environment.d/10-time-format.conf > /dev/null <<EOF
LC_TIME=en_US.UTF-8
EOF

# For immediate effect in current session
export LC_TIME=en_US.UTF-8

# Show current status
echo ""
echo "Time configuration updated:"
timedatectl status

echo ""
echo "Current time in 12-hour format:"
date "+%I:%M:%S %p %Z on %A, %B %d, %Y"

echo ""
echo "To make 12-hour format persistent in your shell, add to ~/.zshrc:"
echo 'export LC_TIME=en_US.UTF-8'

echo ""
echo "You may need to logout/login or reboot for all changes to take effect."