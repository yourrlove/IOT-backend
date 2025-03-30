FROM node:23-alpine

WORKDIR /backend

COPY package*.json ./

RUN npm install

# Change ownership before copying files
RUN chown -R node:node /backend

# Switch to non-root user
USER node

# Copy remaining files
COPY --chown=node:node . .

EXPOSE 8081

CMD [ "npm", "start" ]