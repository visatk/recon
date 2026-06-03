FROM docker.io/cloudflare/sandbox:0.11.0-python

# Install Network Recon Tools (Nmap, wget, unzip, jq)
RUN apt-get update && apt-get install -y \
    nmap wget unzip jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install ProjectDiscovery's Subfinder via pre-compiled binary
ENV SUBFINDER_VERSION="2.6.6"
RUN wget -q "https://github.com/projectdiscovery/subfinder/releases/download/v${SUBFINDER_VERSION}/subfinder_${SUBFINDER_VERSION}_linux_amd64.zip" -O subfinder.zip && \
    unzip subfinder.zip -d /usr/local/bin/ && \
    rm subfinder.zip && \
    chmod +x /usr/local/bin/subfinder

# Ensure standard execution workspace
WORKDIR /workspace
