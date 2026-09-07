#!/bin/bash
set -euo pipefail

LOG_DIR="/var/lib/kafka/data"
CLUSTER_ID_FILE="${LOG_DIR}/cluster_id"
SERVER_PROPS="${KAFKA_HOME}/config/kraft/server.properties"

# Bake the LAN-facing address into the EXTERNAL listener at container
# start. Only affects EXTERNAL — the PLAINTEXT listener stays "kafka",
# fixed, for other containers on the compose network.
EXTERNAL_HOST="${KAFKA_EXTERNAL_HOST:-localhost}"
sed -i "s/EXTERNAL_HOST_PLACEHOLDER/${EXTERNAL_HOST}/" "${SERVER_PROPS}"

# Format storage only once — on first ever start of this data volume
if [ ! -f "${LOG_DIR}/meta.properties" ]; then
  echo "No existing KRaft storage found — formatting ${LOG_DIR}..."
  if [ ! -f "${CLUSTER_ID_FILE}" ]; then
    "${KAFKA_HOME}/bin/kafka-storage.sh" random-uuid > "${CLUSTER_ID_FILE}"
  fi
  CLUSTER_ID=$(cat "${CLUSTER_ID_FILE}")
  "${KAFKA_HOME}/bin/kafka-storage.sh" format \
    --standalone \
    -t "${CLUSTER_ID}" \
    -c "${SERVER_PROPS}"
else
  echo "Existing KRaft storage found — skipping format."
fi

exec "${KAFKA_HOME}/bin/kafka-server-start.sh" "${SERVER_PROPS}"