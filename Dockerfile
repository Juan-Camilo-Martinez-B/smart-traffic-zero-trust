FROM node:18-alpine

WORKDIR /usr/src/app

# Set default env variables, can be overridden by docker-compose
ENV NODE_ENV=production

# The context will be the specific microservice folder, but we also need shared.
# Since we are building from the root, we need to pass the service name as an argument.
ARG SERVICE_NAME

# Copy root package.json for shared dependencies
COPY package*.json ./
RUN npm install --production

# Copy the shared folder first
COPY shared ./shared

# Copy package files
COPY ${SERVICE_NAME}/package*.json ./${SERVICE_NAME}/

# Install dependencies
WORKDIR /usr/src/app/${SERVICE_NAME}
RUN npm install --production

# Copy the rest of the application code
COPY ${SERVICE_NAME}/ .

# Expose ports (can be overridden or ignored by docker-compose)
EXPOSE 3000 443

CMD ["node", "index.js"]
