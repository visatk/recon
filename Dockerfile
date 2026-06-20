FROM docker.io/cloudflare/sandbox:0.12.1-python

RUN apt-get update && apt-get install -y \
    nmap wget unzip jq whois dnsutils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV SUBFINDER_VERSION="2.6.6"
ENV HTTPX_VERSION="1.6.8"

RUN wget -q "https://github.com/projectdiscovery/subfinder/releases/download/v${SUBFINDER_VERSION}/subfinder_${SUBFINDER_VERSION}_linux_amd64.zip" -O subfinder.zip && \
    unzip subfinder.zip -d /usr/local/bin/ && \
    rm subfinder.zip && \
    chmod +x /usr/local/bin/subfinder

RUN wget -q "https://github.com/projectdiscovery/httpx/releases/download/v${HTTPX_VERSION}/httpx_${HTTPX_VERSION}_linux_amd64.zip" -O httpx.zip && \
    unzip httpx.zip -d /usr/local/bin/ && \
    rm httpx.zip && \
    chmod +x /usr/local/bin/httpx

WORKDIR /workspace
