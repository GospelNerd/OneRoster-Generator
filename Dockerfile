# Zero-dependency app, so the image is just Node + source.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV PORT=4400
ENV HOST=0.0.0.0
EXPOSE 4400
CMD ["node", "src/server.js"]
