#!/usr/bin/env bash
# Runs a RapidMiner process file with RapidMiner Studio Core 9.7.0 - no GUI, no account, no licence key.
# Needs Java 11+ (javac) and Maven (mvn) for the first run, which downloads the engine (about 110 MB).
#
# Usage: rapidminer/tools/core-runner/run.sh <process.rmp> [macro=value ...] [--input=<csv>] [--result=<csv>]
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="${RM_CORE_WORK:-$DIR/.work}"

if [ ! -d "$WORK/lib" ]; then
  echo "Downloading RapidMiner Studio Core 9.7.0 to $WORK/lib ..." >&2
  mvn -q -B -f "$DIR/pom.xml" -Dmaven.repo.local="$WORK/m2" dependency:copy-dependencies -DoutputDirectory="$WORK/lib"
fi
mkdir -p "$WORK/classes" "$WORK/home"
javac -nowarn -cp "$WORK/lib/*" -d "$WORK/classes" "$DIR/RunProcess.java" 2>&1 | grep -v '^Note:' >&2 || true

# user.home keeps RapidMiner's settings folder (.RapidMiner) inside $WORK
exec java -Xmx1g -Djava.awt.headless=true -Duser.home="$WORK/home" \
  --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED \
  --add-opens java.desktop/java.awt=ALL-UNNAMED \
  -cp "$WORK/classes:$WORK/lib/*" RunProcess "$@"
