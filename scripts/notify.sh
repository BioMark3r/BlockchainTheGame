#!/usr/bin/env bash
# Usage: ./scripts/notify.sh "Your message here"
CHAT_ID="5679123089"
TOKEN="8060294358:AAEFnCkLUCt-wjui1wyDkkDvL0nq7fqHbyE"
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${CHAT_ID}" \
  --data-urlencode "text=$1" > /dev/null
