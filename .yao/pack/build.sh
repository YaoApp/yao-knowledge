docker run -it --rm \
      -v <Your App Root>:/app \
      -e APP_NAME="knowledge" \
      -e PACK_FLAG="-l 123456" \
      -e PACK_ENV="/app/pack.build.yao" \
      yaoapp/yao-build:0.10.3-amd64 make