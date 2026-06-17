#!/bin/sh
set -e

if [ -z "$DISPLAY" ] && command -v Xvfb >/dev/null 2>&1; then
  Xvfb :99 -screen 0 1280x720x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
  export DISPLAY=:99
fi

exec "$@"
