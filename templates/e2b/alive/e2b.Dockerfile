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
# Install as root, then set up for the 'user' account (created by e2b provisioning at boot).
# Claude's native install expects ~/.local/bin/claude and ~/.local/share/claude/versions/.
# Without this structure, it errors: "installMethod is native, but directory ... does not exist"
RUN curl -fsSL https://claude.ai/install.sh | bash && \
    CLAUDE_BIN="$(readlink -f /root/.local/bin/claude)" && \
    CLAUDE_VERSION="$(basename "$CLAUDE_BIN")" && \
    cp "$CLAUDE_BIN" /usr/local/bin/claude && \
    mkdir -p /home/user/.local/bin /home/user/.local/share/claude/versions && \
    cp "$CLAUDE_BIN" "/home/user/.local/share/claude/versions/$CLAUDE_VERSION" && \
    ln -sf "/home/user/.local/share/claude/versions/$CLAUDE_VERSION" /home/user/.local/bin/claude

# Bun (copy to /usr/local/bin so it's accessible to all users)
RUN curl -fsSL https://bun.sh/install | bash && \
    cp /root/.bun/bin/bun /usr/local/bin/bun && \
    ln -sf /usr/local/bin/bun /usr/local/bin/bunx

# pnpm
RUN npm install -g pnpm

# Workspace dir (user is created by e2b provisioning at boot)
RUN mkdir -p /home/user/project

WORKDIR /home/user/project
