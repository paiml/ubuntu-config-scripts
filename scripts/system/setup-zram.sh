#!/bin/bash
# 128GB Total ZRAM: 64GB swap + 64GB builds
# Using 50% of RAM per device to minimize kernel page-table overhead
# (4TB config was wasting ~48GB on metadata alone)
set -e

modprobe zram num_devices=2

# zram0: 64GB Swap
echo zstd > /sys/block/zram0/comp_algorithm
echo 68719476736 > /sys/block/zram0/disksize
mkswap /dev/zram0
swapon -p 100 /dev/zram0

# zram1: 64GB Builds filesystem  
echo zstd > /sys/block/zram1/comp_algorithm
echo 68719476736 > /sys/block/zram1/disksize
mkfs.ext4 -q -L zram-builds /dev/zram1
mount /dev/zram1 /mnt/zram
chmod 1777 /mnt/zram
mkdir -p /mnt/zram/{targets,sccache,coverage}
chmod 1777 /mnt/zram/targets /mnt/zram/sccache /mnt/zram/coverage

# Aggressive swappiness for ZRAM
sysctl -w vm.swappiness=180

echo "ZRAM configured: 64GB swap + 64GB builds"
