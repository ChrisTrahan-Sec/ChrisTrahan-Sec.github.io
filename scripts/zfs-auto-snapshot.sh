#!/bin/bash
set -euo pipefail
POOL="tank"
TS=$(date +%F-%H%M)
DS_LIST=("${POOL}/backend" "${POOL}/nas" "${POOL}/backend/db" "${POOL}/backend/www" "${POOL}/backend/docker")
for ds in "${DS_LIST[@]}"; do
  zfs snapshot "${ds}@hourly-${TS}" || true
done
prune() {
  local ds=$1
  zfs list -H -t snapshot -o name -s creation -r "${ds}" \
    | grep -E "@hourly-" \
    | awk -F@ '{print $2"\t"$0}' \
    | sort -r \
    | tail -n +25 \
    | cut -f2- \
    | xargs -r -n1 zfs destroy
  zfs list -H -t snapshot -o name -s creation -r "${ds}" \
    | grep -E "@daily-" \
    | awk -F@ '{print $2"\t"$0}' \
    | sort -r \
    | tail -n +8 \
    | cut -f2- \
    | xargs -r -n1 zfs destroy
  zfs list -H -t snapshot -o name -s creation -r "${ds}" \
    | grep -E "@weekly-" \
    | awk -F@ '{print $2"\t"$0}' \
    | sort -r \
    | tail -n +5 \
    | cut -f2- \
    | xargs -r -n1 zfs destroy
}
for ds in "${DS_LIST[@]}"; do
  prune "${ds}" || true
done
exit 0
