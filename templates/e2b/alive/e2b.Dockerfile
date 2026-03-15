FROM e2bdev/base:latest

# System packages (provision script needs these + extras)
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    # required by e2b provisioning
    systemd systemd-sysv openssh-server sudo chrony linuxptp socat \
    curl ca-certificates fuse3 iptables git nfs-common \
    # dev tools
    build-essential jq wget unzip ripgrep fd-find tmux vim \
    # for gh cli
    gpg && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install -y gh && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Claude Code CLI
# Download binary directly (the install script runs `claude install` which OOMs in build VMs).
# Set up the native install structure for both root and 'user' (created by e2b provisioning at boot).
RUN GCS_BUCKET="https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases" && \
    VERSION=$(curl -fsSL "$GCS_BUCKET/latest") && \
    curl -fsSL -o /usr/local/bin/claude "$GCS_BUCKET/$VERSION/linux-x64/claude" && \
    chmod +x /usr/local/bin/claude && \
    mkdir -p /home/user/.local/bin /home/user/.local/share/claude/versions && \
    cp /usr/local/bin/claude "/home/user/.local/share/claude/versions/$VERSION" && \
    ln -sf "/home/user/.local/share/claude/versions/$VERSION" /home/user/.local/bin/claude

# Node 22 LTS (base image ships 20 at /usr/local/bin/node, override it)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    rm -f /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx

# Bun (copy to /usr/local/bin so it's accessible to all users)
RUN curl -fsSL https://bun.sh/install | bash && \
    cp /root/.bun/bin/bun /usr/local/bin/bun && \
    ln -sf /usr/local/bin/bun /usr/local/bin/bunx

# Workspace dir (user is created by e2b provisioning at boot)
RUN mkdir -p /home/user/project

WORKDIR /home/user/project
