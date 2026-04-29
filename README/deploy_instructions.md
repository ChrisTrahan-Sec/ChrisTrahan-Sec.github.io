# Deploy ZFS Auto Snapshot Service

Copy the script and systemd units to the server, then enable and start the timer.

```bash
sudo cp scripts/zfs-auto-snapshot.sh /usr/local/sbin/zfs-auto-snapshot.sh
sudo chmod +x /usr/local/sbin/zfs-auto-snapshot.sh
sudo cp systemd/zfs-auto-snapshot.service /etc/systemd/system/zfs-auto-snapshot.service
sudo cp systemd/zfs-auto-snapshot.timer /etc/systemd/system/zfs-auto-snapshot.timer
sudo systemctl daemon-reload
sudo systemctl enable --now zfs-auto-snapshot.timer
sudo systemctl start zfs-auto-snapshot.timer
sudo systemctl status zfs-auto-snapshot.timer --no-pager
```
