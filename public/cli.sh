#!/bin/bash
# Double Rates CLI — See Claude 2× usage rate status in your terminal
# curl -sL https://double-rates.pages.dev/cli.sh | bash

GREEN='\033[32m'
RED='\033[31m'
ORANGE='\033[38;2;217;119;87m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

ET_HOUR=$(TZ='America/New_York' date +%H | sed 's/^0//')
ET_MIN=$(TZ='America/New_York' date +%M | sed 's/^0//')
ET_DOW=$(TZ='America/New_York' date +%u)
LOCAL_TZ=$(date +%Z)

IS_WEEKEND=0
IS_PEAK=0
if [ "$ET_DOW" -ge 6 ]; then
  IS_WEEKEND=1
elif [ "$ET_HOUR" -ge 8 ] && [ "$ET_HOUR" -lt 14 ]; then
  IS_PEAK=1
fi

# Header
printf '%b' "\n${ORANGE}${BOLD}Double${RESET}${BOLD} Rates${RESET}  ${DIM}March 13–27, 2026${RESET}\n"
printf '%b' "${DIM}────────────────────────────────────${RESET}\n"

# Current status
if [ "$IS_WEEKEND" -eq 1 ]; then
  printf '%b' "${GREEN}${BOLD}  2× RATE${RESET}  Weekend — double rate all day!\n"
elif [ "$IS_PEAK" -eq 1 ]; then
  REMAINING=$(( (14 - ET_HOUR) * 60 - ET_MIN ))
  printf '%b' "${RED}${BOLD}  NORMAL RATE${RESET}  Peak hours, normal rate applies.\n"
  if [ "$REMAINING" -le 60 ]; then
    printf '%b' "  ${GREEN}→ 2× off-peak in ${REMAINING}m${RESET}\n"
  else
    printf '%b' "  ${GREEN}→ 2× off-peak in $((REMAINING / 60))h $((REMAINING % 60))m${RESET}\n"
  fi
else
  if [ "$ET_HOUR" -lt 8 ]; then
    REMAINING=$(( (8 - ET_HOUR) * 60 - ET_MIN ))
  else
    REMAINING=$(( (32 - ET_HOUR) * 60 - ET_MIN ))
  fi
  printf '%b' "${GREEN}${BOLD}  2× RATE${RESET}  Double usage rate — off-peak hours\n"
  if [ "$REMAINING" -le 60 ]; then
    printf '%b' "  ${DIM}→ peak in ${REMAINING}m${RESET}\n"
  else
    printf '%b' "  ${DIM}→ peak in $((REMAINING / 60))h $((REMAINING % 60))m${RESET}\n"
  fi
fi

printf '%b' "${DIM}────────────────────────────────────${RESET}\n"

# 24h timeline
printf '%b' "  ${DIM}00    06    12    18    24${RESET}\n"
printf '%b' "  "

# Build timeline bar (36 chars = 24 hours, each char = 40 min)
for i in $(seq 0 35); do
  HOUR=$(( i * 24 / 36 ))
  # Check if this position is in peak hours (8-14 ET) on weekdays
  if [ "$IS_WEEKEND" -eq 1 ]; then
    printf '%b' "${GREEN}▓${RESET}"
  elif [ "$HOUR" -ge 8 ] && [ "$HOUR" -lt 14 ]; then
    printf '%b' "${RED}░${RESET}"
  else
    printf '%b' "${GREEN}▓${RESET}"
  fi
done
printf '\n'

# Now marker
NOW_POS=$(( (ET_HOUR * 36 / 24) + 2 ))
printf "%${NOW_POS}s" ""
printf '%b' "${ORANGE}▲${RESET} ${DIM}now ($(TZ='America/New_York' date +%I:%M\ %p) ET)${RESET}\n"

# Your local peak window
if [ "$IS_WEEKEND" -eq 1 ]; then
  printf '%b' "\n  ${DIM}Peak hours only apply on weekdays${RESET}\n"
else
  PEAK_START_LOCAL=$(TZ='America/New_York' date -j -f "%H:%M" "08:00" "+%s" 2>/dev/null)
  PEAK_END_LOCAL=$(TZ='America/New_York' date -j -f "%H:%M" "14:00" "+%s" 2>/dev/null)
  if [ -n "$PEAK_START_LOCAL" ] && [ -n "$PEAK_END_LOCAL" ]; then
    LOCAL_START=$(date -j -f "%s" "$PEAK_START_LOCAL" "+%I:%M %p" 2>/dev/null)
    LOCAL_END=$(date -j -f "%s" "$PEAK_END_LOCAL" "+%I:%M %p" 2>/dev/null)
    printf '%b' "\n  ${DIM}Peak (1×) in your timezone: ${LOCAL_START} – ${LOCAL_END} ${LOCAL_TZ}${RESET}\n"
  fi
fi

printf '%b' "\n  ${DIM}https://support.claude.com/en/articles/14063676${RESET}\n\n"
