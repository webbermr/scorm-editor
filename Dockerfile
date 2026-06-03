# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# install deps (cached unless package manifests change)
COPY package.json package-lock.json ./
RUN npm ci

# build the static site
COPY . .
RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
