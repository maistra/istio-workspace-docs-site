#!/bin/bash

RELEASES_URL=https://api.github.com/repos/Maistra/istio-workspace/releases

if [[ "$#" -eq 0 ]]; then
  echo "please provide target directory"
  exit 0
fi

dir=$1

## Download all released versions
curl -sSL $RELEASES_URL \
  | grep -oP '"tag_name": "\K(.*)(?=")' \
  | DIR="$dir" xargs -I {} sh -c 'curl -sSL http://git.io/get-ike | bash -s -- --version="$1" --name=ike_$1 --dir="${DIR}"' - {}