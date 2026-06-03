FROM docker.io/cloudflare/sandbox:0.11.0-python

# Install additional Python packages
RUN pip install --no-cache-dir \
    scikit-learn==1.3.0 \
    tensorflow==2.13.0 \
    transformers==4.30.0

# Install Node.js packages globally
RUN npm install -g typescript ts-node prettier

# Install system packages
RUN apt-get update && apt-get install -y \
    postgresql-client \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*
