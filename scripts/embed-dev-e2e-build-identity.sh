#!/bin/sh
set -eu

OUTPUT_DIRECTORY="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
OUTPUT_FILE="${OUTPUT_DIRECTORY}/DevE2EBuildIdentity.plist"

if [ "${CONFIGURATION}" != "Debug" ]; then
  /bin/rm -f "${OUTPUT_FILE}"
  exit 0
fi

REPOSITORY_ROOT="${SRCROOT}/.."
REPOSITORY_SHA="$(/usr/bin/git -C "${REPOSITORY_ROOT}" rev-parse HEAD)"
case "${REPOSITORY_SHA}" in
  *[!a-f0-9]*|'')
    echo "Invalid repository SHA for Dev E2E build identity" >&2
    exit 1
    ;;
esac
if [ "${#REPOSITORY_SHA}" -ne 40 ]; then
  echo "Repository SHA must contain exactly 40 lowercase hex characters" >&2
  exit 1
fi

/bin/mkdir -p "${OUTPUT_DIRECTORY}"
/usr/bin/plutil -create xml1 "${OUTPUT_FILE}"
/usr/bin/plutil -insert schemaVersion -integer 1 "${OUTPUT_FILE}"
/usr/bin/plutil -insert nativeBridgeVersion -string 1 "${OUTPUT_FILE}"
/usr/bin/plutil -insert integratedRepositorySha -string \
  "${REPOSITORY_SHA}" "${OUTPUT_FILE}"
