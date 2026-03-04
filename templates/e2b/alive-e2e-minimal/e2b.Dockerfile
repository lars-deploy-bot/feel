FROM debian:bookworm-slim

# Keep the runtime minimal: shell + coreutils + certificates.
RUN apt-get update \
  && apt-get install -y --no-install-recommends bash coreutils ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash user \
  && mkdir -p /home/user/project \
  && chown -R user:user /home/user

WORKDIR /home/user/project
USER user

CMD ["bash", "-lc", "sleep infinity"]
