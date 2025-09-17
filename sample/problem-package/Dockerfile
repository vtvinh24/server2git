FROM node:alpine

# Create app directory
WORKDIR /app

# Copy package.json and install deps first for better caching
COPY package.json /app/
RUN npm install --production

# Copy rest of files
COPY . /app/

# Ensure logs folder and entrypoint are available
RUN mkdir -p /logs \
	&& chmod +x /app/entrypoint.sh

# Entrypoint will run the provided command and capture logs
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command runs the evaluator
CMD ["node", "/app/scripts/eval.js"]